import * as Discord from 'discord.js';
import { readConfig } from "./readConfig";
import { ConfigOptions, SendableChannel } from "./types";
import { startWebServer } from "./webServer";
import { forwardMessage } from "./forwardMessage";
import { createHash } from "crypto";
import Database from "./db.js";

startWebServer();

let db = Database("./db.json") as {
    msgWatch: { message: Discord.Message, originalMessage: Discord.Message, options: ConfigOptions, hash: string }[]
};
db.msgWatch??=[];

readConfig().then(async (config: {
    token: string
    redirects: {
        sources: string[]
        destinations: string[]
        options: ConfigOptions
    }[]
}) => {

    // load Discord.js client
    let client = new Discord.Client({
        // intents: [
        //     'GUILD_MESSAGES'
        // ]
    });
    client.login(config.token);

    let redirects: Map<
        string, // source channel
        Array<{
            destination: string
            destinationChannel?: SendableChannel
            options: ConfigOptions
        }>
    > = new Map();

    // loop through redirects and put them in a Map
    for(let redirect of config.redirects){

        // check if redirect is valid
        if(!Array.isArray(redirect.sources)) throw "config: redirect has no defined `sources`";
        if(!Array.isArray(redirect.destinations)) throw "config: redirect has no defined `destinations`";
        if(redirect.sources.length==0) throw "config: redirect has no `sources`";
        if(redirect.destinations.length==0) throw "config: redirect has no `destinations`";

        let options: ConfigOptions = redirect.options ?? {};
        for(let source of redirect.sources){
            skip: for(let destination of redirect.destinations){
                let data = redirects.get(source) ?? [];

                // skip duplicate redirects
                for(let dataCheck of data){
                    if(dataCheck.destination==destination){
                        console.warn("config: redirect from `"+source+"` to `"+destination+"` is a duplicate, I will accept the only the first redirect to avoid duplicate redirects");
                        continue skip;
                    }
                }

                data.push({ destination, options });
                redirects.set(source, data);
            }
        }
    }

    // count redirects (optional code)
    let totalRedirects = 0;
    redirects.forEach(redirect => totalRedirects += redirect.length);
    console.debug("Redirects in total: "+totalRedirects);

    // wait until Discord client loads
    console.log("Discord.js is loading...");
    let channelLoadPromise: Promise<void[]>;
    client.on("ready", async () => {
        console.log("Discord client is ready, loading channels...");

        // we need this since we disabled all discord.js caching
        let channelCache: Map<string, Promise<SendableChannel>> = new Map();

        // this is meant for loading channels if used cache-less discord.js
        let loadChannelPromises: Promise<void>[] = [];
        for(let redirectList of redirects){
            for(let redirect of redirectList[1]){

                let channelPromise = channelCache.get(redirect.destination) ?? client.channels.fetch(redirect.destination);
                channelCache.set(redirect.destination, channelPromise as Promise<SendableChannel>);

                loadChannelPromises.push((async ()=>{
                    let channel = await channelPromise;
                    if (isTextChannel(channel.type)) {
                        redirect.destinationChannel = channel as Discord.TextChannel;
                    }else{
                        throw "channel `"+redirect.destination+"` is not a text channel";
                    }
                })());

            };
        };
        channelLoadPromise = Promise.all(loadChannelPromises);
        await channelLoadPromise;
        console.log("Channels loaded");
    });

    let sleep = (ms: number)=>new Promise(res=>setTimeout(res,ms));
    function getHash(msg: Discord.Message){
        let all = msg.author.username+msg.author.discriminator+msg.author.displayAvatarURL+msg.content+": "+msg.embeds.map(embed=>embed.toJSON()).join(",");
        return createHash("md5").update(all).digest("hex");
    }
    client.on("ready",()=>setTimeout(async ()=>{
        while(true){
            await sleep(1000);
            for(let redirect of config.redirects){
                for(let source of redirect.sources){
                    let ch = client.channels.cache.get(source) as Discord.DMChannel;
                    let msgs = [...Array.from((await ch.messages.fetch()).values()).map(i=>i)];
                    if(msgs.length>=50){
                        while(msgs.length<(redirect.options.editTrackingMaxMsg??250)){
                            let prevLen = msgs.length;
                            msgs.push(...Array.from((await ch.messages.fetch({
                                before: msgs[msgs.length-1].id
                            })).values()));
                            if(prevLen==msgs.length) break;
                        }
                    }
                    for(let rmsg of msgs){
                        for(let msg of db.msgWatch){
                            if(msg.originalMessage.id!=rmsg.id)continue;
                            let update = false;
                            let oldHash = msg.hash;
                            msg.hash = getHash(rmsg);
                            if(msg.hash!=oldHash){
                                client.emit("messageUpdate", msg.originalMessage, rmsg);
                            }
                            await sleep(250);
                        }
                    }
                }
            }
        }
    },2000));

    client.on("message", async message => {
        // wait while channels are still loading
        await channelLoadPromise;

        let id = message.channel.id;

        // skip our messages
        if(message.author.id == client.user.id) return;

        // ignore other types of messages (pinned, joined user)
        if(message.type != "DEFAULT") return;

        // get redirects for channel ID
        let redirectList = redirects.get(id);

        // skip if redirects does not exist
        if(!redirectList) return;

        // loop through redirects
        let promisesMsgs: { promise: Promise<{ msg: Discord.Message, options: ConfigOptions }>, originalMessage: Discord.Message}[] = [];
        for(let { destinationChannel, options } of redirectList){
            if(
                options.minLength &&
                message.content.length < options.minLength &&
                message.content.length != 0 &&
                message.attachments.size == 0
            ) continue;
            if (!message.content && !(options.copyEmbed ?? true) && !(options.copyAttachments ?? true)) continue;
            let whitelisted = false;
            if (options.allowList) {
                for(let allowed of options.allowList){
                    if(message.author.bot){
                        whitelisted ||= allowed=="bot";
                        whitelisted ||= allowed=="bots";
                    }else{
                        whitelisted ||= allowed=="human";
                        whitelisted ||= allowed=="humans";
                    }
                    whitelisted ||= message.author.id == allowed;
                }
            } else {
                whitelisted = true;
            }
            if (options.denyList) {
                for(let deny of options.denyList){
                    if(message.author.bot){
                        whitelisted &&= deny!="bot";
                        whitelisted &&= deny!="bots";
                    }else{
                        whitelisted &&= deny!="human";
                        whitelisted &&= deny!="humans";
                    }
                    whitelisted &&= message.author.id != deny;
                }
            }
            if (!whitelisted) continue;
            promisesMsgs.push({
                promise: forwardMessage(destinationChannel, message, options, false),
                originalMessage: message
            });
        }
        
        for(let { promise, originalMessage } of promisesMsgs){
            let promiseAnswer = await promise.catch(error=>{
                // oh no, let's better not crash whole discord bot and just catch the error
                console.error(error);
            });
            if(!promiseAnswer) continue;
            let { msg, options } = promiseAnswer;
            if ((options.allowEdit ?? true) || options.allowDelete) {
                // add to edit events
                db.msgWatch.push({ message: msg, originalMessage, options, hash: getHash(originalMessage) });
                if(db.msgWatch.length>(options.editTrackingMaxMsg??250)){
                    db.msgWatch.shift();
                }
            }
        }

    });

    client.on("messageDelete", msg=>{
        for(let { message, options, originalMessage } of db.msgWatch){
            if(originalMessage.id == msg.id && originalMessage.channel.id == msg.channel.id){
                if(options.allowDelete && message.deletable){
                    db.msgWatch = db.msgWatch.filter(m=>m.originalMessage.id!=msg.id);
                    message.delete().catch(error=>{});
                }
            }
        }
    });

    client.on("messageUpdate", async (oldMsg, msg)=>{
        for(let rmsg of db.msgWatch){
            if(rmsg.originalMessage.id == msg.id){
                if ((rmsg.options.allowEdit ?? true)) {
                    rmsg.originalMessage = await msg.fetch();
                    if(rmsg.message.edit==undefined){
                        rmsg.message = new Discord.Message(client, rmsg.message as any, client.channels.cache.get((rmsg.message as any).channelID) as Discord.TextChannel);
                    }
                    // rmsg.message = await rmsg.message.fetch();
                    forwardMessage(rmsg.message.channel as SendableChannel, rmsg.originalMessage, rmsg.options, rmsg.message).catch(error=>{
                        // oh no, let's better not crash whole discord bot and just catch the error
                        console.error(error);
                    });
                }
            }
        }
    });

});

function isTextChannel(type: string) {
    // return type == "GUILD_PUBLIC_THREAD" || type == "GUILD_PRIVATE_THREAD" || type == "DM" || type == "GUILD_TEXT" || type == "GROUP_DM" || type == "GUILD_NEWS";
    return type == "text";
}
