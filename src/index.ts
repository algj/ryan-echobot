import * as Discord from 'discord.js';
import { readConfig } from "./readConfig";
import { ConfigOptions, SendableChannel } from "./types";
import { startWebServer } from "./webServer";
import { forwardMessage } from "./forwardMessage";

startWebServer();

readConfig().then(async config => {

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

    // watch messages for edits and deletions
    let msgWatch: { message: Discord.Message, originalMessage: Discord.Message, options: ConfigOptions }[] = []; 
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
                originalMessage: message as Discord.Message
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
                msgWatch.push({ message: msg, originalMessage, options });
                if(msgWatch.length>1000){
                    msgWatch.shift();
                }
            }
        }

    });

    client.on("messageDelete", msg=>{
        for(let { message, options, originalMessage } of msgWatch){
            if(originalMessage.id == msg.id && originalMessage.channel.id == msg.channel.id){
                if(options.allowDelete && message.deletable){
                    message.delete().catch(error=>{});
                }
            }
        }
    });

    client.on("messageUpdate", (oldMsg, msg)=>{
        for(let { message, options, originalMessage } of msgWatch){
            if(originalMessage.id == msg.id && originalMessage.channel.id == msg.channel.id){
                if ((options.allowEdit ?? true)) {
                    forwardMessage(message.channel as SendableChannel, originalMessage, options, message as Discord.Message).catch(error=>{
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
