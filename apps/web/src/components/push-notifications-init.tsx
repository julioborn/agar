'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { createClient } from '@/lib/supabase/client';

// Solo registra el token del dispositivo en push_tokens; no envía notificaciones.
// Queda listo para cuando se implemente el envío real a futuro.
export default function PushNotificationsInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let regListener: { remove: () => void } | undefined;
    let errListener: { remove: () => void } | undefined;

    (async () => {
      const current = await PushNotifications.checkPermissions();
      let granted = current.receive === 'granted';
      if (!granted) {
        const requested = await PushNotifications.requestPermissions();
        granted = requested.receive === 'granted';
      }
      if (!granted) return;

      regListener = await PushNotifications.addListener('registration', async (token) => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase
          .from('push_tokens')
          .upsert(
            { usuario_id: user.id, token: token.value, plataforma: Capacitor.getPlatform() },
            { onConflict: 'token' },
          );
      });

      errListener = await PushNotifications.addListener('registrationError', (err) => {
        console.error('[push] registration error', err);
      });

      await PushNotifications.register();
    })();

    return () => {
      regListener?.remove();
      errListener?.remove();
    };
  }, []);

  return null;
}
