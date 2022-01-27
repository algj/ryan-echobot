import * as Discord from 'discord.js';
import { ConfigOptions, SendableChannel } from './types';
import { fetchWebhook } from "./webhookManager";
import fetch from "node-fetch";

export async function forwardMessage(
    channel: SendableChannel,
    message: Discord.Message | Discord.PartialMessage,
    options: ConfigOptions,
    edit: false | Discord.Message
): Promise<{ msg: Discord.Message, options: ConfigOptions }> {
    let hook: Discord.Webhook | false = options.webhook && await fetchWebhook(channel);
    if(options.webhook && !hook){
        return forwardMessageWebhookFailed(channel, message, options, edit);
    }

    let { author, attachments } = message;
    let { username } = author;
    let avatarURL = options.webhookAvatarURL ?? author.displayAvatarURL();

    // variables which will later on be used to send the message
    let content = ""; // message text
    let embeds: Discord.MessageEmbed[] = [];
    let allowedMentions = { users: [] };
    if(options.allowMentions){
        allowedMentions = undefined;
    }
    if (!(options.copyAttachments ?? true)) {
        // if attachments disabled, overwrite attachments with empty collection
        attachments = new Discord.Collection<string, Discord.MessageAttachment>();
    }

    if (options.copyEmbed ?? true) {
        embeds.push(...message.embeds);
    }

    if(options.embed){
        let embed = new Discord.MessageEmbed()
            .setColor(options.embed.color ?? "#2F3136")
            .setTitle(options.embed.title ?? "Forwarded message:")
            .setDescription(message.content)
            // .setURL(message.url)
            // .setThumbnail('https://i.imgur.com/wSTFkRM.png')
            // .addFields(
            //     { name: 'Regular field title', value: 'Some value here' },
            //     { name: '\u200B', value: '\u200B' },
            //     { name: 'Inline field title', value: 'Some value here', inline: true },
            //     { name: 'Inline field title', value: 'Some value here', inline: true },
            // )
            // .setImage('https://i.imgur.com/wSTFkRM.png')
            // .setFooter('Some footer text here', 'https://i.imgur.com/wSTFkRM.png');
        options.embed?.timestamp && embed.setTimestamp(message.createdAt)
        options.embed?.author && embed.setAuthor(username + "#" + author.discriminator, avatarURL, message.url)

        options.embed?.fields?.author && embed.addField('Author', "<@" + author.id + ">", true)
        options.embed?.fields?.server && embed.addField('Server', message.guild.name, true)
        options.embed?.fields?.channel && embed.addField('Channel', "#" + (message.channel as Discord.TextChannel).name, true)

        embeds.push(embed);
    }else{
        content = message.content;
        if (options.includeAuthorAsEmbed) {
            embeds.push(
                new Discord.MessageEmbed()
                    .setColor("#2F3136")
                    .setAuthor(username+"#"+author.discriminator, avatarURL, message.url)
            );
        }
    }

    let embedLimit = hook?10:1;

    if(embeds.length > embedLimit){
        console.error("Too many embeds! Removing last embeds: "+embeds.length+" > "+embedLimit)
        embeds = embeds.slice(0, embedLimit);
    }

    if(options.includeAuthor || options.includeAuthorTag || options.includeChannel){
        content += "\n\n";
    }
    if(options.includeAuthor){
        content += " *"+username+"#"+author.discriminator+"*";
    }
    if(options.includeAuthorTag){
        content += " <@"+author.id+">";
    }
    if(options.includeChannel){
        content += " in *#"+(message.channel as Discord.TextChannel).name+"*";
    }

    let files = Array.from(attachments.values());
    if(hook){
        let sendHook = async ()=>{
            if(!hook) throw "Not hook"; // impossible error, just to avoid confusing ts
            let usernameDisplay = (options.webhookUsername ?? username) + (options.webhookUsernameChannel ? " - #" + (message.channel as Discord.TextChannel).name : "");
            if(!edit){
                return {
                    msg: await hook.send(content, { files, embeds, username: usernameDisplay, avatarURL, allowedMentions }) as Discord.Message,
                    options
                };
            }else{
                // fuck this old version of discord.js
                let resp = await fetch(`https://discord.com/api/v9/webhooks/${hook.id}/${hook.token}/messages/${edit.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ content, files, embeds, allowedMentions }),
                    headers: {
                        "Content-Type": "application/json"
                    }
                });
                if(!resp.ok){
                    console.log(await resp.json());
                }
                return { msg: edit, options };
            }
        };
        try{
            return await sendHook();
        }catch(e){
            console.error("Failed to "+(edit?"edit":"send")+" hook message! Retrying in 15 seconds.", e);
            await sleep(15000);
            try{
                return await sendHook();
            }catch(e){
                if(edit){
                    console.error("Failed to edit webhook message. Skipping this message.");
                    throw "Failed to edit webhook message";
                }
                console.error("Failed to send hook message again! Sending without webhook.");
                return await forwardMessageWebhookFailed(channel, message, options, edit);
            }
        }
    }

    if(edit){
        await edit.edit(content, { files, embed: embeds[0] });
        return { msg:edit, options };
    }else{
        return {
            msg: await channel.send(content, { files, embed: embeds[0], allowedMentions }),
            options
        };
    }
}

function forwardMessageWebhookFailed(channel, message, options, edit){
    let includeAuthorAsEmbed = options.includeAuthorAsEmbed || !options.webhookUsername;
    if(options.includeAuthor || options.includeAuthorTag){
        includeAuthorAsEmbed=false;
    }
    return forwardMessage(channel, message, {
        ...options,
        webhook: false,
        includeAuthorAsEmbed
    }, edit);
}

let sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
