import XCTest

/// CMUX-54 visual evidence: a long prompt's bubble in the shipping app's offline DEBUG chat (the
/// list rig's replayed transcript with `CMUX_MOBILE_LIST_GIANT=1`, so every third prompt is a
/// pasted log of a few hundred lines). Scrolls to the transcript's top, then up through the long
/// prompt, attaching a screenshot at each stop. Before the fix the bubble's text sat far below its
/// top, centered in empty bubble; after it, the text starts 11 pt under the bubble's top.
/// This is visual evidence; `DisclosureAnimationTests.aLongPromptsBubbleHugsItsText` is the check.
final class LongPromptBubbleCaptureUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    func testLongPromptBubbleCapture() {
        XCUIDevice.shared.orientation = .portrait
        let app = XCUIApplication()
        app.launchEnvironment["CMUX_MOBILE_MOCK_AUTH"] = "1"
        app.launchEnvironment["CMUX_MOBILE_LIST_SCREEN"] = "chat"
        app.launchEnvironment["CMUX_MOBILE_LIST_COUNT"] = "3"
        app.launchEnvironment["CMUX_MOBILE_LIST_GIANT"] = "1"
        app.launchEnvironment["CMUX_MOBILE_LIST_PASSES"] = "0"
        app.launchEnvironment["CMUX_MOBILE_LIST_LARGE_DIFF"] = "0"
        app.launchArguments += ["-cmuxMobile.setupComplete", "YES"]
        app.launch()
        defer { app.terminate() }

        let more = app.navigationBars.buttons["More"].firstMatch
        XCTAssertTrue(more.waitForExistence(timeout: 40), "the stress chat opens\n\(app.debugDescription)")
        // Let the rig finish opening (it holds 2.5 s) and the rows lay out.
        _ = app.staticTexts["no-such-element"].waitForExistence(timeout: 4)
        attach(app, "00-bottom")
        // To the top: the status bar's scroll-to-top.
        app.statusBars.firstMatch.exists ? app.statusBars.firstMatch.tap()
            : app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.01)).tap()
        _ = app.staticTexts["no-such-element"].waitForExistence(timeout: 2)
        attach(app, "01-top")
        // Up through the transcript, one screen at a time, past the long prompt's top.
        for step in 2 ..< 10 {
            let from = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.7))
            let to = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3))
            from.press(forDuration: 0.05, thenDragTo: to, withVelocity: .slow, thenHoldForDuration: 0.3)
            attach(app, String(format: "%02d-scrolled", step))
        }
    }

    @MainActor
    private func attach(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
