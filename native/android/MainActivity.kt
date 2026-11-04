package org.fromzerotogpt.learning

import android.content.Context
import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    initializeNdkContext(applicationContext)
    super.onCreate(savedInstanceState)
  }

  companion object {
    @JvmStatic
    external fun initializeNdkContext(context: Context)
  }
}
