import * as Discord from 'discord.js';
export type ConfigOptions = {
    webhook?: boolean
    webhookUsername?: string
    webhookUsernameChannel?: boolean
    webhookAvatarURL?: string

    embed?: {
        title?: string
        color?: Discord.ColorResolvable
        timestamp?: boolean
        author?: boolean
        fields?: {
            author?: boolean
            server?: boolean
            channel?: boolean
        }
    },

    includeAuthorTag?: boolean
    includeAuthorAsEmbed?: boolean
    includeAuthor?: boolean
    includeChannel?: boolean

    allowMentions?: boolean
    allowEdit?: boolean
    allowDelete?: boolean

    editTrackingMaxMsg?: number

    copyEmbed?: boolean
    copyAttachments?: boolean
    minLength?: number

    allowList?: []
    denyList?: []
};

export type ConfigRedirect = {
    sources?: string[]
    destinations?: string[]
    options?: ConfigOptions
};

export type Config = {
    token: string,
    redirects: ConfigRedirect[];
};

export type SendableChannel = Discord.TextChannel | Discord.NewsChannel;
