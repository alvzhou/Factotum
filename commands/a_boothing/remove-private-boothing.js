// Discord.js commando requirements
const { Command } = require('discord.js-commando');
const discordServices = require('../../discord-services');

// Command export
module.exports = class RemovePrivates extends Command {
    constructor(client) {
        super(client, {
            name: 'removeprivates',
            group: 'a_boothing',
            memberName: 'remove private voice channels',
            description: 'Will remove x number of private voice channels from the sponsor boothing category.',
            guildOnly: true,
            args: [
                {
                    key: 'number',
                    prompt: 'number of private channels',
                    type: 'integer',
                },
            ],
        });
    }

    // Run function -> command body
    async run(message, {number}) {
        discordServices.deleteMessage(message);

        // make sure command is only used in the boothing-wait-list channel
        if (message.channel.name != 'boothing-wait-list') {
            discordServices.replyAndDelete(message, 'This command can only be ran in the boothing-wait-list channel!');
            return;
        }
        // only memebers with the Attendee tag can run this command!
        if (!(await discordServices.checkForRole(message.member, discordServices.staffRole))) {
            discordServices.replyAndDelete(message, 'This command can only be ran by staff!');
            return;
        }

        // get category
        var category = await message.guild.channels.cache.get(discordServices.sponsorCategory);

        // get private channels
        var channels = category.children.filter((value, index) => {
            if (value.name.includes('Private')){
                return true;
            } else {
                return false;
            }
        });

        // number of channels
        var amount = channels.array().length;

        // make sure there are enough channels to remove
        if (amount < number) {
            number = amount;
        }

        var total = amount - number;

        // remove voice channels
        for (var index = amount; index > total; index--) {
            var channel = await category.children.find(channel => channel.name === 'Private-' + index);
            channel.delete();
        }

        // report success of workshop creation
        message.reply('Sponsor boothing now has ' + total + ' voice channels.');
    }
};