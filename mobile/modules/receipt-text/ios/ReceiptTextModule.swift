import ExpoModulesCore
import Vision
import UIKit

/// Reads text lines from a receipt photo on the device (Apple Vision).
/// Lines come back top-to-bottom; words on the same row are joined so the
/// price stays on the same line as the item name.
public class ReceiptTextModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReceiptText")

    AsyncFunction("recognize") { (uri: String, promise: Promise) in
      guard let url = URL(string: uri), let data = try? Data(contentsOf: url), let image = UIImage(data: data), let cg = image.cgImage else {
        promise.reject("E_IMAGE", "Couldn't read that photo")
        return
      }
      let request = VNRecognizeTextRequest { req, err in
        if let err = err { promise.reject("E_VISION", err.localizedDescription); return }
        let obs = (req.results as? [VNRecognizedTextObservation]) ?? []
        let items: [(y: CGFloat, x: CGFloat, h: CGFloat, text: String)] = obs.compactMap { o in
          guard let t = o.topCandidates(1).first?.string else { return nil }
          return (1 - o.boundingBox.midY, o.boundingBox.minX, o.boundingBox.height, t)
        }.sorted { $0.y == $1.y ? $0.x < $1.x : $0.y < $1.y }
        var rows: [[(x: CGFloat, text: String)]] = []
        var rowY: CGFloat = -1
        var rowH: CGFloat = 0
        for it in items {
          if rowY >= 0 && abs(it.y - rowY) < max(rowH, it.h) * 0.6 {
            rows[rows.count - 1].append((it.x, it.text))
          } else {
            rows.append([(it.x, it.text)])
            rowY = it.y
            rowH = it.h
          }
        }
        promise.resolve(rows.map { $0.sorted { $0.x < $1.x }.map { $0.text }.joined(separator: " ") })
      }
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = false
      let orientation = CGImagePropertyOrientation(image.imageOrientation)
      DispatchQueue.global(qos: .userInitiated).async {
        do { try VNImageRequestHandler(cgImage: cg, orientation: orientation, options: [:]).perform([request]) }
        catch { promise.reject("E_VISION", error.localizedDescription) }
      }
    }
  }
}

extension CGImagePropertyOrientation {
  init(_ o: UIImage.Orientation) {
    switch o {
    case .up: self = .up
    case .down: self = .down
    case .left: self = .left
    case .right: self = .right
    case .upMirrored: self = .upMirrored
    case .downMirrored: self = .downMirrored
    case .leftMirrored: self = .leftMirrored
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
