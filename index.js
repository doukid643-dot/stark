require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const express = require('express');
// CORS disabled
const cors = require('cors');
const database = require('./database');
const app = express();

// تهيئة قاعدة البيانات Firestore
database.initDatabase().catch(console.error);

// CORS disabled to avoid cross-origin issues
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());

// تهيئة المتغيرات الأساسية
const clientId = process.env.CLIENT_ID || process.env.APPLICATION_ID;
const discordToken = process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 3000;

// إنشاء Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
    ],
});

// معالجة الأخطاء
client.on('error', (error) => {
    console.error('Discord Client Error:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// أمر لوحة التحكم الأساسي
const commands = [
    new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('لوحة تحكم المشرفين')
        .setDefaultMemberPermissions(0)
];

const rest = new REST({ version: '10' }).setToken(discordToken);

// تسجيل أوامر Slash
client.once('ready', async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
    
    console.log(`Logged in as ${client.user.tag}!`);
    
    // تعيين Bot Activity Status
    client.user.setPresence({
        activities: [{
            name: 'Developer by StarK',
            type: 3,
            status: 'online'
        }],
        status: 'online'
    });
    
    console.log('Bot Activity Status set successfully!');
});

// معالجة التفاعلات
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    if (interaction.commandName === 'dashboard') {
        const dashboardUrl = process.env.DASHBOARD_URL || 'https://ticketx-dashboard.web.app';
        
        const linkEmbed = new EmbedBuilder()
            .setTitle('🔗 رابط لوحة تحكم المشرفين')
            .setDescription(`**مرحباً بك في لوحة تحكم البوت!**\n\n` +
                `اضغط على الزر أدناه للدخول إلى لوحة التحكم:\n\n` +
                `📊 **مميزات لوحة التحكم:**\n` +
                `• عرض وإدارة التذاكر\n` +
                `• الإحصائيات الكاملة\n` +
                `• إعداد البوت\n` +
                `• التحكم بالإيموجيات\n` +
                `• إضافة صورة للوحة التذكرة`)
            .setColor(0x0099ff)
            .setTimestamp();
        
        const linkButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('فتح لوحة التحكم')
                    .setStyle(ButtonStyle.Link)
                    .setURL(dashboardUrl)
                    .setEmoji('🌐')
            );
        
        await interaction.reply({ embeds: [linkEmbed], components: [linkButton], flags: MessageFlags.Ephemeral });
    }
});

// Login to Discord
client.login(discordToken).catch(function(error) {
    console.error('Failed to login to Discord:', error);
});

// ==================== API Routes ====================

// API: جلب السيرفرات التي فيها البوت
app.get('/api/guilds', (req, res) => {
    if (!client.isReady()) {
        return res.status(503).json({ error: 'البوت غير متصل' });
    }
    
    const guilds = client.guilds.cache.map(g => ({
        id: g.id,
        name: g.name,
        icon: g.icon
            ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
            : null
    }));

    res.json(guilds);
});

// API: حالة البوت
app.get('/api/status', (req, res) => {
    res.json({
        connected: client.isReady(),
        user: client.user ? client.user.tag : 'Not connected',
        guilds: client.guilds.cache.size
    });
});

// API: إحصائيات السيرفرات
app.get('/api/server-stats', (req, res) => {
    const guilds = client.guilds.cache.map(guild => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
        memberCount: guild.memberCount,
        channelCount: guild.channels.cache.size,
        roleCount: guild.roles.cache.size
    }));
    
    const totalMembers = guilds.reduce((sum, g) => sum + g.memberCount, 0);
    
    res.json({
        totalGuilds: guilds.length,
        totalMembers: totalMembers,
        guilds: guilds
    });
});

// API: بيانات السيرفر
app.get('/api/guild/:guildId', async (req, res) => {
    try {
        // جلب السيرفر من Discord API بشكل مباشر
        let guild = client.guilds.cache.get(req.params.guildId);
        
        if (!guild) {
            try {
                guild = await client.guilds.fetch(req.params.guildId);
            } catch (e) {
                return res.status(404).json({ error: 'السيرفر غير موجود أو البوت ليس فيه' });
            }
        }
        
        // جلب عدد الأعضاء
        let memberCount = guild.memberCount;
        
        // إذا كان عدد الأعضاء غير متاح (Large guild)، جلبه من API
        if (!memberCount || memberCount === 0) {
            try {
                await guild.members.fetch();
                memberCount = guild.members.cache.size;
            } catch (e) {
                console.log('Could not fetch members, using estimate');
                memberCount = guild.approximateMemberCount || guild.memberCount || 'غير متاح';
            }
        }
        
        // جلب القنوات بشكل مباشر من API لتحديث البيانات
        let channels;
        try {
            const fetchedChannels = await guild.channels.fetch();
            channels = {
                text: fetchedChannels.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name })),
                voice: fetchedChannels.filter(c => c.type === 2).map(c => ({ id: c.id, name: c.name })),
                category: fetchedChannels.filter(c => c.type === 4).map(c => ({ id: c.id, name: c.name }))
            };
        } catch (e) {
            // إذا فشل الجلب، استخدم الـ cache
            channels = {
                text: guild.channels.cache.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name })),
                voice: guild.channels.cache.filter(c => c.type === 2).map(c => ({ id: c.id, name: c.name })),
                category: guild.channels.cache.filter(c => c.type === 4).map(c => ({ id: c.id, name: c.name }))
            };
        }
        
        // جلب الرتب بشكل مباشر
        let roles;
        try {
            const fetchedRoles = await guild.roles.fetch();
            roles = fetchedRoles.map(r => ({ id: r.id, name: r.name }));
        } catch (e) {
            roles = guild.roles.cache.map(r => ({ id: r.id, name: r.name }));
        }
        
        res.json({
            id: guild.id,
            name: guild.name,
            icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
            memberCount: memberCount,
            channels: channels,
            roles: roles
        });
    } catch (error) {
        console.error('Error fetching guild:', error);
        res.status(500).json({ error: 'خطأ في جلب بيانات السيرفر' });
    }
});

// دالة لجلب جميع قنوات السيرفر وتحديثها
async function fetchAllChannels(guildId) {
  try {
    const guild = await client.guilds.fetch(guildId);
    // force: true يتجاوز الـ cache ويجلب من API مباشرة
    const channels = await guild.channels.fetch(undefined, { force: true });
    
    console.log(`✅ تم جلب ${channels.size} قناة من السيرفر ${guild.name}`);
    
    // تحويل القنوات إلى صيغة مناسبة للإرسال
    const channelsList = channels.map(channel => ({
      id: channel.id,
      name: channel.name,
      type: channel.type, // 0 = text, 2 = voice, 4 = category
      category: channel.parent?.name || null
    }));
    
    return channelsList;
  } catch (error) {
    console.error('❌ خطأ في جلب القنوات:', error);
    return [];
  }
}

// API: جلب جميع قنوات السيرفر
app.get('/api/guilds/:guildId/channels', async (req, res) => {
  try {
    const { guildId } = req.params;
    const channels = await fetchAllChannels(guildId);
    res.json({ success: true, channels });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: إعادة تشغيل البوت
app.post('/api/control/restart', (req, res) => {
  res.json({ success: true, message: 'تم استلام طلب إعادة التشغيل' });
  
  // إعادة تشغيل البوت
  console.log('جاري إعادة تشغيل البوت...');
  client.destroy().then(() => {
    client.login(discordToken).then(() => {
      console.log('✅ تم إعادة تشغيل البوت بنجاح');
    }).catch(err => {
      console.error('❌ فشل في إعادة تسجيل الدخول:', err);
    });
  }).catch(err => {
    console.error('❌ فشل في تسجيل الخروج:', err);
  });
});

// API: بيانات
app.get('/api/data', (req, res) => {
    res.json({
        tickets: [],
        settings: {}
    });
});

// API: إعدادات الإيموجيات
app.get('/api/emoji-settings', (req, res) => {
    res.json({});
});

app.post('/api/settings-emoji', (req, res) => {
    res.json({ success: true });
});

// API: إعدادات الرتب
app.get('/api/role-settings', (req, res) => {
    res.json({});
});

app.post('/api/settings-roles', (req, res) => {
    res.json({ success: true });
});

// API: تصنيفات التذاكر
app.get('/api/ticket-categories', (req, res) => {
    res.json([]);
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
