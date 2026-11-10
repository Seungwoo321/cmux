#if os(iOS)
import Testing
import UIKit
@testable import CmuxMobileAgentChat
@testable import CmuxMobileMarkdown

/// TEMPORARY probe for CMUX-54: where boundingRect and UILabel disagree. Removed before landing.
@MainActor
@Suite struct BubbleMeasureProbeTests {
    @Test func probe() {
        let styles = NativeTextStyles(category: .large)
        let font = styles.font(.body)
        let width: CGFloat = 402 * 0.8 - 32
        func attributed(_ s: String) -> NSAttributedString {
            let p = NSMutableParagraphStyle(); p.lineBreakMode = .byWordWrapping; p.lineSpacing = 4
            return NSAttributedString(string: s, attributes: [.font: font, .foregroundColor: UIColor.label, .paragraphStyle: p])
        }
        let shapes: [String] = [
            "8+256|user: engine->codex gpt-6-sol high; 'make me a workspace' failed (socket sandboxed), none made; QA ws_10e08619 wants blockers ASAP",
            "16+128|a25 ws_f25e7ead fixes Claude-terminal Feed details; a26 ws_eeea7723 iOS Create Team. a22 Phone-Mac #34526 at 53a400f2, suites/e2e running, unmerged.",
            "24+1|tool: mcp__optchat__send {\"text\":\"Panes fit window: a49 is done. The fix is in [#37445](https://github.com/manaflow-ai/cmux/pull/37445) and stays unmerged\"}",
            "32+1|echo: outcome: done. sent",
            "40+4|user 2003: “is cmux internal iOS failing? if so fix it?”; spawned a51 (ws_3b1966b8fdf399628b7f1ad4cf05b6b7, cmuxterm-hq, shown, medium) — owed: tell user…",
            "plain words only here so that this line wraps across several lines of the bubble without any long tokens at all in it",
        ]
        var out: [String] = ["font \(font.fontName) \(font.pointSize) lineHeight \(font.lineHeight) leading \(font.leading) width \(width)"]
        func row(_ name: String, _ s: String) {
            let a = attributed(s)
            let lead = a.boundingRect(with: CGSize(width: width, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil).height
            let noLead = a.boundingRect(with: CGSize(width: width, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin], context: nil).height
            let lines = ChatNativeLayout.lineCount(a, width: width)
            let label = UILabel(); label.numberOfLines = 0; label.lineBreakMode = .byWordWrapping
            label.lineBreakStrategy = ChatNativeLayout.labelLineBreakStrategy; label.attributedText = a
            let drawn = label.textRect(forBounds: CGRect(x: 0, y: 0, width: width, height: 100_000), limitedToNumberOfLines: 0).height
            out.append("\(name): bR+lead \(lead) bR \(noLead) tk1Lines \(lines) label \(drawn) labelLines~\((drawn + 4) / (font.lineHeight + 4))")
        }
        for (i, s) in shapes.enumerated() { row("shape\(i)", s) }
        row("6 shapes joined", shapes.joined(separator: "\n"))
        row("60 lines", Array(repeating: shapes.joined(separator: "\n"), count: 10).joined(separator: "\n"))
        row("600 lines", Array(repeating: shapes.joined(separator: "\n"), count: 100).joined(separator: "\n"))
        row("1200 plain", Array(repeating: shapes[5], count: 1200).joined(separator: "\n"))
        Issue.record(Comment(rawValue: "PROBE\n" + out.joined(separator: "\n")))
    }
}
#endif
