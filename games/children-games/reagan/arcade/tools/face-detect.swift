#!/usr/bin/env swift
/* =====================================================================
   tools/face-detect.swift — 用 macOS Vision 检出人脸框

   为什么要自动检：手估人脸坐标很不准，脸偏一点就裁到下巴或背景。
   Vision 检出的框是归一化的（原点左下），换算成像素只要两步。

   用法：
     swiftc -O tools/face-detect.swift -o /tmp/face_detect
     /tmp/face-detect 照片.jpg [更多照片...]

   输出：每行「路径<TAB>宽x高<TAB>x,y,w,h（多个脸用 | 分隔，原点左下）」

   然后交给 tools/gen-avatars.py 按框裁头像。
   ===================================================================== */
import Foundation
import Vision
import AppKit

for path in CommandLine.arguments.dropFirst() {
    guard let img = NSImage(contentsOfFile: path),
          let tiff = img.tiffRepresentation,
          let bmp = NSBitmapImageRep(data: tiff),
          let cg = bmp.cgImage else {
        print("\(path)\tERROR")
        continue
    }
    let req = VNDetectFaceRectanglesRequest()
    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    try? handler.perform([req])

    let faces = (req.results ?? []).map { f -> String in
        let b = f.boundingBox   // 原点在左下
        return String(format: "%.4f,%.4f,%.4f,%.4f", b.origin.x, b.origin.y, b.size.width, b.size.height)
    }
    print("\(path)\t\(cg.width)x\(cg.height)\t\(faces.joined(separator: " | "))")
}