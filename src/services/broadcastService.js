const supabase = require('./supabaseClient');

/**
 * Starts the broadcast worker which polls the message_queue table.
 * @param {import('discord.js').Client} client 
 */
function startBroadcastWorker(client) {
    console.log('[BroadcastService] Worker started (processing 1 message every 10 seconds)...');

    setInterval(async () => {
        try {
            // 1. Durumu 'pending' olan 1 adet mesajı çek ve subscriptions tablosuyla BİRLEŞTİR (JOIN)
            const { data: messages, error } = await supabase
                .from('message_queue')
                .select(`
                    id,
                    message_content,
                    subscriptions (
                        owner_id,
                        guild_name,
                        guild_id
                    )
                `)
                .eq('status', 'pending')
                .limit(1);

            if (error) {
                if (error.code !== 'PGRST116') {
                    console.error("[BroadcastService] Queue Poll Error:", error.message);
                }
                return;
            }

            if (!messages || messages.length === 0) return; // Kuyruk boş

            const msg = messages[0];
            
            // Subscriptions tablosundan gelen veriler (JOIN sayesinde)
            const subscription = msg.subscriptions;
            if (!subscription) {
                // Eğer bağlı subscription bulunamazsa (silinmişse vb.) failed yap
                await supabase.from('message_queue')
                    .update({ status: 'failed', error_message: 'Bağlı sunucu kaydı bulunamadı.' })
                    .eq('id', msg.id);
                return;
            }

            const ownerId = subscription.owner_id;
            const guildName = subscription.guild_name;

            // 2. Başka bir bot/worker aynı mesajı almasın diye durumu 'processing' yap
            await supabase.from('message_queue')
                .update({ status: 'processing', updated_at: new Date().toISOString() })
                .eq('id', msg.id);

            try {
                // 3. Dinamik içerik değişimi: {sunucu} -> sunucu_adi
                const finalMessage = msg.message_content.replace(/{sunucu}/g, guildName);

                // 4. Discord üzerinden mesajı gönder
                const user = await client.users.fetch(ownerId);
                if (!user) throw new Error('Kullanıcı bulunamadı.');

                await user.send(finalMessage);
                
                // 5. Başarılı olursa durumu 'completed' yap
                await supabase.from('message_queue')
                    .update({ status: 'completed', updated_at: new Date().toISOString() })
                    .eq('id', msg.id);
                
                console.log(`[BroadcastService] Mesaj başarıyla gönderildi: ${user.tag} (Sunucu: ${guildName})`);

            } catch (dmError) {
                // 6. Hata olursa (DM kapalı vb.) durumu 'failed' yap ve hatayı kaydet
                await supabase.from('message_queue')
                    .update({ 
                        status: 'failed', 
                        error_message: dmError.message,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', msg.id);
                
                console.error(`[BroadcastService] Mesaj gönderilemedi: ${ownerId} Error: ${dmError.message}`);
            }

        } catch (err) {
            console.error('[BroadcastService] Critical Error:', err.message);
        }
    }, 10000); // 10 saniyede bir
}

module.exports = { startBroadcastWorker };
