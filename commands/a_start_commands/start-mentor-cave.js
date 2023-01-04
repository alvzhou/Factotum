const { Command } = require('@sapphire/framework');
const { Interaction, MessageEmbed } = require('discord.js');
const { randomColor } = require('../../discord-services');
const { Message, Collection } = require('discord.js');
const BotGuild = require('../../db/mongo/BotGuild')
const winston = require('winston');
const BotGuildModel = require('../../classes/Bot/bot-guild');
const { NumberPrompt, SpecialPrompt, RolePrompt } = require('advanced-discord.js-prompts');
const { MessageActionRow, MessageButton } = require('discord.js');
const { MessageSelectMenu, Modal, TextInputComponent } = require('discord.js');

/**
 * The start mentor cave command creates a cave for mentors. To know what a cave is look at [cave]{@link Cave} class.
 * @category Commands
 * @subcategory Start-Commands
 * @extends PermissionCommand
 * @guildonly
 */
class StartMentorCave extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            description: 'Start mentor cave'
        });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('start-mentor-cave')
                .setDescription(this.description)
                .addIntegerOption(option =>
                    option.setName('inactivity_time')
                        .setDescription('How long (minutes) before bot asks users to delete ticket channels')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('unanswered_ticket_time')
                        .setDescription('How long (minutes) shall a ticket go unaccepted before the bot sends a reminder to all mentors?')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('request_ticket_role')
                        .setDescription('Tag the role that is allowed to request tickets')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('additional_mentor_role')
                        .setDescription('Tag up to one additional role **aside from mentors and staff** that is allowed to help with tickets')
                        .setRequired(false))
        )
    }

    /**
     * @param {BotGuildModel} botGuild
     * @param {Message} message - the message in which the command was run
     */
    async chatInputRun(interaction) {
        try {
            // helpful prompt vars
            let channel = interaction.channel;
            let userId = interaction.user.id;
            let guild = interaction.guild;
            this.botGuild = await BotGuild.findById(guild.id);
            let adminConsole = guild.channels.resolve(this.botGuild.channelIDs.adminConsole);
            this.ticketCount = 0;

            const additionalMentorRole = interaction.options.getRole('additional_mentor_role');
            console.log(additionalMentorRole);
            const publicRole = interaction.options.getRole('request_ticket_role');
            const inactivePeriod = interaction.options.getInteger('inactivity_time');
            const bufferTime = inactivePeriod / 2;
            const reminderTime = interaction.options.getInteger('unanswered_ticket_time')

            if (!guild.members.cache.get(userId).roles.cache.has(this.botGuild.roleIDs.staffRole) && !guild.members.cache.get(userId).roles.cache.has(this.botGuild.roleIDs.adminRole)) {
                return this.error({ message: 'You do not have permissions to run this command!', ephemeral: true })
            }

            interaction.reply({ content: 'Mentor cave activated!', ephemeral: true })

            // create channels
            let overwrites =
                [{
                    id: this.botGuild.roleIDs.everyoneRole,
                    deny: ['VIEW_CHANNEL'],
                },
                {
                    id: this.botGuild.roleIDs.mentorRole,
                    allow: ['VIEW_CHANNEL'],
                },
                {
                    id: this.botGuild.roleIDs.staffRole,
                    allow: ['VIEW_CHANNEL'],
                }]

            if (additionalMentorRole) {
                overwrites.push({
                    id: additionalMentorRole,
                    allow: ['VIEW_CHANNEL']
                })
            }

            let mentorCategory = await channel.guild.channels.create('Mentors',
                {
                    type: "GUILD_CATEGORY",
                    permissionOverwrites: overwrites
                }
            );

            // await channel.guild.channels.create('mentors-announcements',
            //     {
            //         type: "GUILD_TEXT",
            //         parent: mentorCategory,
            //         permissionOverwrites: [
            //             {
            //                 id: this.botGuild.roleIDs.mentorRole,
            //                 deny: ['SEND_MESSAGES'],
            //             }
            //         ]
            //     }
            // )

            const mentorRoleSelectionChannel = await channel.guild.channels.create('mentors-role-selection',
                {
                    type: "GUILD_TEXT",
                    topic: 'Sign yourself up for specific roles! New roles will be added as requested, only add yourself to one if you feel comfortable responding to questions about the topic.',
                    parent: mentorCategory
                }
            );

            //TODO: allow staff to add more roles
            const htmlCssEmoji = '💻';
            const jsTsEmoji = '🕸️';
            const pythonEmoji = '🐍';
            const sqlEmoji = '🐬';
            const reactEmoji = '⚛️';
            const noSqlEmoji = '🔥';
            const javaEmoji = '☕';
            const cEmoji = '🎮';
            const cSharpEmoji = '💼';
            const reduxEmoji = '☁️';
            const figmaEmoji = '🎨';
            const unityEmoji = '🧊';
            const rustEmoji = '⚙️';
            const awsEmoji = '🙂';
            const ideationEmoji = '💡';

            let emojisMap = new Map();
            emojisMap.set(htmlCssEmoji, 'HTML/CSS');
            emojisMap.set(jsTsEmoji, 'JavaScript/TypeScript');
            emojisMap.set(pythonEmoji, 'Python');
            emojisMap.set(sqlEmoji, 'SQL');
            emojisMap.set(reactEmoji, 'React');
            emojisMap.set(noSqlEmoji, 'NoSQL');
            emojisMap.set(javaEmoji, 'Java');
            emojisMap.set(cEmoji, 'C/C++');
            emojisMap.set(cSharpEmoji, 'C#');
            emojisMap.set(reduxEmoji, 'Redux');
            emojisMap.set(figmaEmoji, 'Figma');
            emojisMap.set(unityEmoji, 'Unity');
            emojisMap.set(rustEmoji, 'Rust');
            emojisMap.set(awsEmoji, 'AWS');
            emojisMap.set(ideationEmoji, 'Ideation');

            const mentorRoleColour = guild.roles.cache.find(role => role.id === this.botGuild.roleIDs.mentorRole).hexColor;
            for (let value of emojisMap.values()) {
                const findRole = guild.roles.cache.find(role => role.name.toLowerCase() === `M-${value}`.toLowerCase());
                if (!findRole) {
                    await guild.roles.create(
                        {
                            name: `M-${value}`,
                            color: mentorRoleColour,
                        }
                    );
                }
            }

            var fields = [];
            for (let [key, value] of emojisMap) {
                fields.push({ name: key + ' --> ' + value, value: '\u200b' });
            }

            const roleSelection = new MessageEmbed()
                .setTitle('Choose what you would like to help hackers with! You can un-react to deselect a role.')
                .setDescription('Note: You will be notified every time a hacker creates a ticket in one of your selected categories!')
                .addFields(fields)

            const roleSelectionMsg = await mentorRoleSelectionChannel.send({ embeds: [roleSelection] });
            for (let key of emojisMap.keys()) {
                roleSelectionMsg.react(key);
            }

            const notBotFilter = i => !i.user.bot;
            const collector = roleSelectionMsg.createReactionCollector({ roleFilter: notBotFilter, dispose: true });
            collector.on('collect', async (reaction, user) => {
                if (emojisMap.has(reaction.emoji.name)) {
                    const value = emojisMap.get(reaction.emoji.name);
                    const findRole = guild.roles.cache.find(role => role.name.toLowerCase() === `M-${value}`.toLowerCase());
                    await guild.members.cache.get(user.id).roles.add(findRole);
                }
            });

            collector.on('remove', async (reaction, user) => {
                if (emojisMap.has(reaction.emoji.name)) {
                    const member = guild.members.cache.get(user.id);
                    const value = emojisMap.get(reaction.emoji.name);
                    const findRole = member.roles.cache.find(role => role.name.toLowerCase() === `M-${value}`.toLowerCase());
                    if (findRole) await guild.members.cache.get(user.id).roles.remove(findRole);
                }
            })

            // channel.guild.channels.create('mentors-general',
            //     {
            //         type: "GUILD_TEXT",
            //         topic: 'Private chat between all mentors and organizers',
            //         parent: mentorCategory
            //     }
            // );

            const incomingTicketChannel = await channel.guild.channels.create('incoming-tickets',
                {
                    type: "GUILD_TEXT",
                    topic: 'Tickets from hackers will come in here!',
                    parent: mentorCategory
                }
            );

            const mentorHelpCategory = await channel.guild.channels.create('Mentor-help',
                {
                    type: "GUILD_CATEGORY",
                    permissionOverwrites: [
                        {
                            id: this.botGuild.roleIDs.everyoneRole,
                            deny: ['VIEW_CHANNEL'],
                        },
                        {
                            id: this.botGuild.roleIDs.memberRole,
                            allow: ['VIEW_CHANNEL'],
                        },
                    ]
                }
            );

            // channel.guild.channels.create('quick-questions',
            //     {
            //         type: "GUILD_TEXT",
            //         topic: 'ask questions for mentors here!',
            //         parent: mentorHelpCategory
            //     }
            // );

            const requestTicketChannel = await channel.guild.channels.create('request-ticket',
                {
                    type: "GUILD_TEXT",
                    topic: 'request 1-on-1 help from mentors here!',
                    parent: mentorHelpCategory,
                    permissionOverwrites: [
                        {
                            id: this.botGuild.roleIDs.memberRole,
                            deny: ['VIEW_CHANNEL']
                        },
                        {
                            id: publicRole,
                            allow: ['VIEW_CHANNEL']
                        }
                    ]
                }
            );

            const requestTicketEmbed = new MessageEmbed()
                .setTitle('Need 1:1 mentor help?')
                .setDescription('Select a technology you need help with and follow the instructions!')

            var options = [];
            for (let value of emojisMap.values()) {
                options.push({ label: value, value: value });
            }
            // options.push({ label: 'None of the above', value: 'None of the above'})

            const selectMenuRow = new MessageActionRow()
                .addComponents(
                    new MessageSelectMenu()
                        .setCustomId('ticketType')
                        .addOptions(options)
                )

            const requestTicketConsole = await requestTicketChannel.send({ embeds: [requestTicketEmbed], components: [selectMenuRow] });

            const selectMenuFilter = i => !i.user.bot && guild.members.cache.get(userId).roles.cache.has(publicRole);
            const selectMenuCollector = requestTicketConsole.createMessageComponentCollector(selectMenuFilter);
            selectMenuCollector.on('collect', async i => {
                if (i.customId === 'ticketType') {
                    requestTicketConsole.edit({ embeds: [requestTicketEmbed], components: [selectMenuRow] });
                    const modal = new Modal()
                        .setCustomId('ticketSubmitModal')
                        .setTitle('Request a ticket for ' + i.values[0])
                        .addComponents([
                            new MessageActionRow().addComponents(
                                new TextInputComponent()
                                    .setCustomId('ticketDescription')
                                    .setLabel('Brief description of your problem')
                                    .setMaxLength(300)
                                    .setStyle('PARAGRAPH')
                                    .setPlaceholder('Describe your problem here')
                                    .setRequired(true),
                            ),
                            new MessageActionRow().addComponents(
                                new TextInputComponent()
                                    .setCustomId('helpFormat')
                                    .setLabel('Receive help in-person, online, or either?')
                                    .setMaxLength(300)
                                    .setPlaceholder('If you select in-person or either, please describe where you are located.')
                                    .setStyle('PARAGRAPH')
                                    .setRequired(true),
                            ),
                        ]);
                    await i.showModal(modal);

                    const submitted = await i.awaitModalSubmit({ time: 300000, filter: j => j.user.id === i.user.id })
                        .catch(error => {
                            console.error(error)
                        });

                    if (submitted) {
                        const role = guild.roles.cache.find(role => role.name.toLowerCase() === `M-${i.values[0]}`.toLowerCase());
                        const description = submitted.fields.getTextInputValue('ticketDescription');
                        const helpFormat = submitted.fields.getTextInputValue('helpFormat')
                        const ticketNumber = this.ticketCount;
                        this.ticketCount++;
                        const ticketEmbed = new MessageEmbed()
                            .setTitle('Ticket #' + ticketNumber)
                            .setColor('#F7CB73')
                            .addFields([
                                {
                                    name: 'Problem description',
                                    value: description
                                },
                                {
                                    name: 'Requested by:',
                                    value: '<@' + submitted.user.id + '>'
                                },
                                {
                                    name: 'How would you like to be helped?',
                                    value: helpFormat
                                }
                            ])
                        const ticketAcceptanceRow = new MessageActionRow()
                            .addComponents(
                                new MessageButton()
                                    .setCustomId('acceptIrl')
                                    .setLabel('Accept ticket (in-person)')
                                    .setStyle('PRIMARY'),
                            )
                            .addComponents(
                                new MessageButton()
                                    .setCustomId('acceptOnline')
                                    .setLabel('Accept ticket (online)')
                                    .setStyle('PRIMARY'),
                            );

                        const ticketMsg = await incomingTicketChannel.send({ content: '<@&' + role.id + '>', embeds: [ticketEmbed], components: [ticketAcceptanceRow] })
                        submitted.reply({ content: 'Your ticket has been submitted!', ephemeral: true })
                        // TODO: allow deletion

                        const ticketAcceptFilter = i => !i.user.bot && i.isButton();
                        const ticketAcceptanceCollector = ticketMsg.createMessageComponentCollector(ticketAcceptFilter);
                        ticketAcceptanceCollector.on('collect', async acceptInteraction => {
                            if (acceptInteraction.customId === 'acceptIrl' || acceptInteraction.customId === 'acceptOnline') {
                                ticketMsg.edit({ content: '<@&' + role.id + '>', embeds: [new MessageEmbed(ticketEmbed).setColor('#00ab66').addFields([{ name: 'Helped by:', value: '<@' + acceptInteraction.user.id + '>' }])], components: [] });
                            }
                            if (acceptInteraction.customId === 'acceptIrl') {
                                acceptInteraction.reply({ content: 'Thanks for accepting their ticket! Please head to their stated location. If you need to contact them, you can click on their username above to DM them!', ephemeral: true })
                            }
                            if (acceptInteraction.customId === 'acceptOnline') {
                                acceptInteraction.reply({ content: 'Thanks for accepting their ticket! You should get a ping from a private channel for this ticket! You can help them there.', ephemeral: true })
                                let ticketChannelOverwrites =
                                    [{
                                        id: this.botGuild.roleIDs.everyoneRole,
                                        deny: ['VIEW_CHANNEL'],
                                    },
                                    {
                                        id: acceptInteraction.user.id,
                                        allow: ['VIEW_CHANNEL'],
                                    },
                                    {
                                        id: submitted.user.id,
                                        allow: ['VIEW_CHANNEL'],
                                    }]

                                let ticketCategory = await channel.guild.channels.create('Ticket-#' + ticketNumber,
                                    {
                                        type: "GUILD_CATEGORY",
                                        permissionOverwrites: ticketChannelOverwrites
                                    }
                                );

                                const ticketText = await channel.guild.channels.create('ticket-' + ticketNumber,
                                    {
                                        type: "GUILD_TEXT",
                                        parent: ticketCategory
                                    }
                                );

                                const ticketVoice = await channel.guild.channels.create('ticket-' + ticketNumber + '-voice',
                                    {
                                        type: "GUILD_VOICE",
                                        parent: ticketCategory
                                    }
                                );

                                const ticketChannelEmbed = new MessageEmbed()
                                    .setColor(this.botGuild.colors.embedColor)
                                    .setTitle('Ticket description')
                                    .setDescription(submitted.fields.getTextInputValue('ticketDescription'))

                                const ticketChannelButtons = new MessageActionRow()
                                    .addComponents(
                                        new MessageButton()
                                            .setCustomId('addMembers')
                                            .setLabel('Add Members to Channels')
                                            .setStyle('PRIMARY'),
                                    )
                                    .addComponents(
                                        new MessageButton()
                                            .setCustomId('leaveTicket')
                                            .setLabel('Leave')
                                            .setStyle('DANGER'),
                                    );
                                const ticketChannelInfoMsg = await ticketText.send({ content: `<@${acceptInteraction.user.id}><@${submitted.user.id}> These are your very own private channels! It is only visible to the admins of the server and any other users (i.e. teammates) you add to this channel with the button labeled "Add Members to Channels" below ⬇️. Feel free to discuss anything in this channel or the attached voice channel. **Please click the "leave" button below when you are done to leave these channels**\n\n**Note: these channels may be deleted if they appear to be inactive for a significant period of time, even if not everyone has left**`, embeds: [ticketChannelEmbed], components: [ticketChannelButtons] });
                                ticketChannelInfoMsg.pin();

                                const ticketChannelCollector = ticketChannelInfoMsg.createMessageComponentCollector(notBotFilter);
                                ticketChannelCollector.on('collect', async ticketInteraction => {
                                    if (ticketInteraction.customId === 'addMembers') {
                                        ticketInteraction.reply({ content: 'Tag the users you would like to add to the channel! (You can mention them by typing @ and then paste in their username with the tag)', ephemeral: true, fetchReply: true })
                                            .then(() => {
                                                const awaitMessageFilter = i => i.user.id === ticketInteraction.user.id
                                                ticketInteraction.channel.awaitMessages({ awaitMessageFilter, max: 1, time: 60000, errors: ['time'] })
                                                    .then(collected => {
                                                        if (collected.first().mentions.members.size === 0) {
                                                            ticketInteraction.followUp({ content: 'You have not mentioned any users! Click the button again to try again.' });
                                                        } else {
                                                            var newMembersArray = [];
                                                            collected.first().mentions.members.forEach(member => {
                                                                ticketCategory.permissionOverwrites.edit(member.id, { VIEW_CHANNEL: true });
                                                                newMembersArray.push(member.id);
                                                            })
                                                            ticketInteraction.channel.send('<@' + newMembersArray.join('><@') + '> Welcome to the channel! You have been invited to join the discussion for this ticket. Check the pinned message for more details.')
                                                        }
                                                    })
                                                    .catch(collected => {
                                                        ticketInteraction.followUp({ content: 'Timed out. Click the button again to try again.', ephemeral: true})
                                                    })
                                            })
                                    } else if (ticketInteraction.customId === 'leaveTicket') {
                                        await ticketCategory.permissionOverwrites.edit(ticketInteraction.user.id, { VIEW_CHANNEL: false });
                                        ticketInteraction.reply({ content: 'Successfully left the channel!', ephemeral: true })
                                        if (ticketCategory.members.filter(member => !member.roles.cache.has(this.botGuild.roleIDs.adminRole) && !member.user.bot).size === 0) {
                                            ticketText.delete();
                                            ticketVoice.delete();
                                            ticketCategory.delete();
                                        }
                                    }
                                })
                            }
                        });
                    }

                }
            })

            // eslint-disable-next-line no-inner-declarations
            // async function checkForDuplicateEmojis(prompt) {
            //     let reaction = await SpecialPrompt.singleRestrictedReaction({prompt, channel, userId}, emojis);
            //     var emoji = reaction.emoji;
            //     emojis.set(emoji.name, emoji);
            //     return emoji;
            // }

            // let cave = new Cave({
            //     name: 'Mentor',
            //     preEmojis: '🧑🏽🎓',
            //     preRoleText: 'M',
            //     color: 'ORANGE',
            //     role: mentorRole,
            //     emojis: {
            //         joinTicketEmoji: '🧑🏽',
            //         giveHelpEmoji: '🧑🏽',
            //         requestTicketEmoji: '🧑🏽',
            //         addRoleEmoji: '🧑🏽',
            //         deleteChannelsEmoji: '🧑🏽',
            //         excludeFromAutoDeleteEmoji: '🧑🏽',
            //     },
            //     times: {
            //         inactivePeriod,
            //         bufferTime,
            //         reminderTime,
            //     },
            //     publicRoles: publicRole,
            // }, botGuild, interaction.guild);

            // await cave.init();

        } catch (error) {
            // winston.loggers.get(interaction.guild.id).warning(`An error was found but it was handled by not setting up the mentor cave. Error: ${error}`, { event: 'StartMentorCave Command' });
        }
    }
}
module.exports = StartMentorCave;