package com.busmate.busmate_student

import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannels()
    }

    /**
     * Two notification channels used by the BusMate server's push messages:
     *  - busmate_alerts:  trip started / other bus news (normal sound, pops up)
     *  - busmate_arrival: "bus arriving in ~10 min" / "bus at your stop" (alarm sound, strong vibration)
     * Students can change the sound of each channel in Android Settings > Apps > BusMate > Notifications.
     */
    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return

        val alerts = NotificationChannel("busmate_alerts", "Bus updates", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Your bus started its trip, and other bus news"
            enableVibration(true)
        }

        val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val arrival = NotificationChannel("busmate_arrival", "Bus arriving at my stop", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Rings when your bus is a few minutes from your stop"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 600, 300, 600, 300, 900)
            setSound(
                alarmSound,
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
        }
        manager.createNotificationChannel(alerts)
        manager.createNotificationChannel(arrival)
    }
}
