package com.busmate.busmate_student

import android.app.Activity
import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Full-screen "bus arriving" alarm.
 *
 * The server sends a data-only push with alarm=1 (see backend notificationService.js).
 * [BusAlarmReceiver] gets it even when the app is closed and posts an alarm notification that:
 *  - rings with the phone's alarm tone and keeps ringing (FLAG_INSISTENT) until dismissed,
 *  - opens [BusAlarmActivity] full screen on the lock screen (needs "full-screen alerts"
 *    permission on Android 14+; otherwise it pops up at the top of the screen and still rings).
 */
object BusAlarm {
    const val CHANNEL_ID = "busmate_alarm"
    const val NOTIFICATION_ID = 7301
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val channel = NotificationChannel(CHANNEL_ID, "Bus arriving alarm", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Rings like an alarm when your bus is a few minutes from your stop"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 800, 400, 800, 400, 800)
            setBypassDnd(true)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            setSound(
                sound,
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
        }
        manager.createNotificationChannel(channel)
    }

    /** True when Android will open the alarm full screen (always true before Android 14). */
    fun canUseFullScreen(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < 34) return true
        val manager = context.getSystemService(NotificationManager::class.java) ?: return false
        return manager.canUseFullScreenIntent()
    }

    fun show(context: Context, title: String, body: String) {
        ensureChannel(context)
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val alarmIntent = Intent(context, BusAlarmActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_BODY, body)
        }
        val fullScreen = PendingIntent.getActivity(context, 1, alarmIntent, flags)
        val dismiss = PendingIntent.getBroadcast(context, 2, Intent(context, BusAlarmDismissReceiver::class.java), flags)

        @Suppress("DEPRECATION")
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(context, CHANNEL_ID)
        } else {
            Notification.Builder(context)
                .setPriority(Notification.PRIORITY_MAX)
                .setDefaults(Notification.DEFAULT_ALL)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM))
        }
        builder
            .setSmallIcon(context.applicationInfo.icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setCategory(Notification.CATEGORY_ALARM)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setFullScreenIntent(fullScreen, true)
            .setContentIntent(fullScreen)
            .setDeleteIntent(dismiss)
            .setAutoCancel(true)
            .setOngoing(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) builder.setTimeoutAfter(3 * 60 * 1000L)

        @Suppress("DEPRECATION")
        builder.addAction(Notification.Action.Builder(0, "I'M READY", dismiss).build())

        val notification = builder.build()
        notification.flags = notification.flags or Notification.FLAG_INSISTENT // keep ringing until dismissed
        manager.notify(NOTIFICATION_ID, notification)
    }

    fun dismiss(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(NOTIFICATION_ID)
    }
}

/** Receives the FCM data message (works when the app is closed) and rings the alarm. */
class BusAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val extras = intent.extras ?: return
        if (extras.getString("alarm") != "1") return
        val title = extras.getString("title") ?: "Your bus is almost here"
        val body = extras.getString("body") ?: "Get ready at your stop."
        try {
            BusAlarm.show(context, title, body)
        } catch (e: Exception) {
            // Never crash the app because of a notification problem.
        }
    }
}

/** "I'M READY" button / swipe away: stop the ringing. */
class BusAlarmDismissReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        BusAlarm.dismiss(context)
    }
}

/** Big full-screen alarm page shown on the lock screen. */
class BusAlarmActivity : Activity() {
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            keyguard.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD,
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val title = intent.getStringExtra(BusAlarm.EXTRA_TITLE) ?: "Your bus is almost here"
        val body = intent.getStringExtra(BusAlarm.EXTRA_BODY) ?: "Get ready at your stop."
        setContentView(buildLayout(title, body))

        // Stop ringing automatically after 2 minutes.
        handler.postDelayed({ stopAndClose() }, 2 * 60 * 1000L)
    }

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    private fun buildLayout(title: String, body: String): LinearLayout {
        val ink = Color.parseColor("#0C1322")
        val amber = Color.parseColor("#F5B301")
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(ink)
            setPadding(dp(28), dp(48), dp(28), dp(48))

            addView(TextView(context).apply {
                text = "🚌"
                textSize = 72f
                gravity = Gravity.CENTER
            })
            addView(TextView(context).apply {
                text = title
                textSize = 26f
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(Color.WHITE)
                gravity = Gravity.CENTER
                setPadding(0, dp(18), 0, dp(10))
            })
            addView(TextView(context).apply {
                text = body
                textSize = 17f
                setTextColor(Color.parseColor("#C9D3E6"))
                gravity = Gravity.CENTER
                setPadding(0, 0, 0, dp(36))
            })
            addView(Button(context).apply {
                text = "I'M READY"
                textSize = 18f
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(ink)
                setBackgroundColor(amber)
                setOnClickListener { stopAndClose() }
            }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(60)))
            addView(Button(context).apply {
                text = "OPEN LIVE MAP"
                textSize = 15f
                setTextColor(Color.WHITE)
                setBackgroundColor(Color.TRANSPARENT)
                setOnClickListener {
                    BusAlarm.dismiss(this@BusAlarmActivity)
                    packageManager.getLaunchIntentForPackage(packageName)?.let { startActivity(it) }
                    finish()
                }
            }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)).apply { topMargin = dp(10) })
        }
    }

    private fun stopAndClose() {
        BusAlarm.dismiss(this)
        finish()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
