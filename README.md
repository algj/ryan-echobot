# Discord EchoBot
Rewritten bot to allow selfbots resending messages to other channels.

This is done by turning your own Discord account into a bot -- copied messages are sent by _you_, not a real bot.

**DISCLAIMER:** Using this (or any) self-bot is **against Discord's [Terms of Service](https://discordapp.com/terms)** — use at your own risk! You may get your account banned and I am NOT RESPONSIBLE for it. You chose to use this. Your responsibility.

## Deployment
### Manual (Your laptop, a server, etc.)

To setup and run this bot, you must first [install Node.js](https://nodejs.org/en/).

1. Download the [latest release](https://github.com/algj/ryan-echobot/archive/refs/heads/master.zip) source code.
2. Extract the source code to a folder of your choosing.
3. Configure the bot by **either**:
    - Creating a file called `config.json` in the extracted directory and filling it out. You can see `config.example.json` for an example. Scroll down to see what each option means.
    - **OR** Pasting the entire config JSON (what would normally be in your file) into the environment variable `ECHOBOT_CONFIG_JSON`. (You can do both but the config file will always take precedence).
      
4. Open a command prompt or terminal in the extracted directory, and run `npm install`.
5. Run `npm run build`
6. Each time you want to start the bot, run `npm start`.

### Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/algj/ryan-echobot/tree/master)

This bot is compatible with Heroku. You can use the button above to deploy it quickly. 

Use the `ECHOBOT_CONFIG_JSON` environment variable to create your config. Simply put everything that would normally be in the config.json file into this variable. Formatting does not matter.

If the `PORT` environment variable is set (which may happen by default), then this bot will start a web server on that port and will reply `pong` to requests at `/ping`. This is useful because you can use a service like [UptimeRobot](https://uptimerobot.com/) to automatically send a request to the `/ping` endpoint to keep your app from sleeping on the Heroku free tier.

## Configuration

Example configurations:
```json
{
  "token": "copy-token-here-from-network-tab",
  "redirects": [
    {
      "sources": [
        "866554433221100420",
        "866554433221100421",
        "866554433221100422"
      ],
      "destinations": [
        "866554433221100069"
      ],
      "options": {
        "webhook": true,
        "webhookUsernameChannel": true,

        "allowMentions": false,

        "copyEmbed": true,
        "copyAttachments": true,

        "allowList": [
          "humans",
          "bots",
          "159985870458322944"
        ]
      }
    }
  ]
}
```
```json
{
  "token": "copy-token-here-from-network-tab",
  "redirects": [
    {
      "sources": [
        "866554433221100420"
      ],
      "destinations": [
        "866554433221100069"
      ],
      "options": {
        "webhook": false,

        "embed": {
          "title": "Forwarded message:",
          "color": "#2F3136",
          "timestamp": true,
          "author": true,

          "fields": {
            "author": true,
            "server": true,
            "channel": true
          }
        },

        "includeAuthor": true,
        "includeChannel": true,
        "includeAuthorAsEmbed": false,
        "includeAuthorTag": true,
        "includeChannel": true,
        "allowMentions": true,

        "copyEmbed": true,
        "copyAttachments": true,
        "minLength": 0,

        "allowList": [
          "humans",
          "bots",
          "159985870458322944"
        ],
        "denyList": [
          "866554433221100420"
        ]
      }
    }
  ]
}
```

There are two ways of sending messages:
1. Usual Discord messages

   ![](https://i.imgur.com/JQCDexH.png)
2. Webhook messages: username and avatar is the same as sender's, but more throttling

   ![](https://i.imgur.com/B2IMTvz.png)

To have webhook messages, enable `webhook` option:

All options are ... well.. optional. Defaults are listed for if you don't include them.

* `embed`: Object with all options of embed. If you don't want embed, just delete it.
  * e.g. ```"embed": { "title": "Forwarded:" }```
  * (Default: no embed)

* `minLength`: The minimum number of characters required in a message body for it to be copied. Messages with embeds will always be copied if `copyRichEmbed` is true. Attachments (including pictures) will be sent if message is too short. Set to `0` to disable.
  * e.g. ```"minLength": 10```
  * (Default `0`)

* `webhook`: Send messages using webhook, allows sending messages with username and avatar, but there's more rate-limit.
  * e.g. ```"webhook": true```
  * (Default `false`)

* `webhookUsername`: Username for webhook message.
  * e.g. ```"webhookUsername": "Baba"```
  * (Default is the username of message author)

* `webhookAvatarURL`: URL of message avatar.
  * e.g. ```"webhookAvatarURL": "https://i.imgur.com/GX20hLP.png"```
  * (Default is the avatar of message author)
  
* `copyEmbed`: Copy author embeds.
  * e.g. ```"copyEmbed": false```
  * (Default `true`)

* `copyAttachments`: Copy author (file) attachments.
  * e.g. ```"copyAttachments": false```
  * (Default `true`)

* `allowEdit`: Automatically edit bot messages when original message was edited.
  * e.g. ```"allowEdit": false```
  * (Default `true`)

* `editTrackingMaxMsg`: How many messages in a channel to keep track of for editing.
  * e.g. ```"editTrackingMaxMsg": 250```
  * (Default `50`)
  
* `allowDelete`: Automatically delete bot messages when original message was deleted.
  * e.g. ```"allowDelete": true```
  * (Default `false`)

* `allowList`: An array that contains the allowed author(s)' Discord IDs, from which the messages will be copied. Use this to filter whose messages will be copied from the channels. Do not set to an empty array, it won't allow anyone. The IDs must be in quotation marks. You may use `"human"`/`"humans"` and `"bot"`/`"bots"`.
  * e.g. ```"allowList": ["37450973459793455", "94730497535793434"]```
  * (Default `["humans", "bots"]`)

* `denyList`: Similar as `allowList`, but instead of allowing authors, it denies them.
  * e.g. ```"denyList": ["37450973459793455", "94730497535793434"]```
  * (Default `[]`)

![](https://i.imgur.com/EWCTUq8.png)

### Finding your Token

This Discord bot is called a "self-bot," meaning it runs as your personal Discord account rather than a separate bot account.

In order for this to work, you need to provide your Discord token in the `config.json` file. To find this token, follow these steps:

1. Open the Discord client on your computer.
2. Push `Ctrl + Shift + I` to open the dev tools (may be different on non-windows operating systems).
3. Go to the `Network` tab.
4. Go to any channel in any guild.
5. Click through the network requests that appear and search for the header `authorization`. 
    - You can usually ignore image requests.
6. Copy the value of the `authorization` header.
    - It will look something like `mfa.aasdkf--SDsdkfjhsdf_ewrh-msufeusefsbeouhue_W-34FsedFwEsr_SDFsufserF4_slhSDF432f`

The token will now be on your clipboard and can be pasted into the config. Make sure there is only one set of quotation marks.

### Finding Channel IDs

Redirect sources and destinations use Channel IDs, which look like large numbers. To find these, follow these steps:

1. Open the Discord client.
2. Go to User Settings.
3. Go to Appearance.
4. Scroll to the bottom and enable Developer Mode.
5. Close User Settings.
6. Right click on any channel (only text channels are supported, not voice) and select `Copy ID`.

The ID will now be on your clipboard and can be pasted into the config.
