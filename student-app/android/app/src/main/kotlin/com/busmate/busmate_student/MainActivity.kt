package com.busmate.busmate_student

import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannels()
        BusAlarm.ensureChannel(this)
    }

    /** "busmate/alarm" channel: lets the Profile screen check / open the full-screen alarm permission and test it. */
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "busmate/alarm").setMethodCallHandler { call, result ->
            when (call.method) {
                "canFullScreen" -> result.success(BusAlarm.canUseFullScreen(this))
                "openFullScreenSettings" -> {
                    try {
                        if (Build.VERSION.SDK_INT >= 34) {
                            startActivity(
                                Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:$packageName")),
                            )
                        } else {
                            startActivity(
                                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName),
                            )
                        }
                        result.success(true)
                    } catch (e: Exception) {
                        result.success(false)
                    }
                }
                "test" -> {
                    // Rings after a few seconds so the student can lock the screen and see the full-screen alarm.
                    val delayMs = ((call.argument<Int>("delaySeconds") ?: 0) * 1000).toLong()
                    val app = applicationContext
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                        BusAlarm.show(app, "🚌 Test: bus arriving in ~10 min", "This is how the bus alarm will ring. Tap I'M READY to stop.")
                    }, delayMs)
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        }
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
