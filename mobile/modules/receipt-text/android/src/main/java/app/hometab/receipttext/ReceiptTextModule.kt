package app.hometab.receipttext

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.abs
import kotlin.math.max

/** Reads text lines from a receipt photo on the device (Google ML Kit, bundled model). */
class ReceiptTextModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReceiptText")

    AsyncFunction("recognize") { uri: String, promise: Promise ->
      val context = appContext.reactContext ?: return@AsyncFunction promise.reject("E_CONTEXT", "No context", null)
      val image = try { InputImage.fromFilePath(context, Uri.parse(uri)) } catch (e: Exception) {
        return@AsyncFunction promise.reject("E_IMAGE", "Couldn't read that photo", e)
      }
      TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS).process(image)
        .addOnSuccessListener { result ->
          data class Piece(val y: Int, val x: Int, val h: Int, val text: String)
          val pieces = result.textBlocks.flatMap { it.lines }.mapNotNull { l ->
            val b = l.boundingBox ?: return@mapNotNull null
            Piece(b.centerY(), b.left, b.height(), l.text)
          }.sortedWith(compareBy({ it.y }, { it.x }))
          val rows = mutableListOf<MutableList<Piece>>()
          var rowY = -1
          var rowH = 0
          for (p in pieces) {
            if (rowY >= 0 && abs(p.y - rowY) < max(rowH, p.h) * 0.6) rows.last().add(p)
            else { rows.add(mutableListOf(p)); rowY = p.y; rowH = p.h }
          }
          promise.resolve(rows.map { r -> r.sortedBy { it.x }.joinToString(" ") { it.text } })
        }
        .addOnFailureListener { e -> promise.reject("E_MLKIT", e.message ?: "Text recognition failed", e) }
    }
  }
}
