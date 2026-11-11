import XCTest

/// CMUX-10 / CMUX-48: in a workspace's agent tab (TabsKit chrome) the jump to
/// bottom circle keeps the same small gap above the composer whether the
/// toolbar is expanded or collapsed into its pill. The person's iPhone showed
/// about 50 pt with the pill and about 10 pt with the full toolbar: the circle
/// stayed where it was while the composer moved down with the toolbar.
final class AgentTabJumpGapUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    func testJumpGapFollowsComposerAcrossToolbarCollapse() {
        XCUIDevice.shared.orientation = .portrait
        let app = XCUIApplication()
        app.launchEnvironment["CMUX_MOBILE_MOCK_AUTH"] = "1"
        app.launchArguments += ["-cmuxMobile.setupComplete", "YES", "-cmux-mobile-demo", "kbd-tab"]
        app.launch()
        defer { app.terminate() }

        // At rest the composer is its collapsed capsule ("Reply to Claude").
        let field = app.buttons["Reply to Claude"].firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 30), "the agent tab's composer\n\(app.debugDescription)")
        let jump = app.buttons["Jump to bottom"].firstMatch

        // Finger down reveals older turns (and expands the toolbar).
        for _ in 0..<4 where !(jump.exists && jump.isHittable) {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.25))
                .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.7)),
                       withVelocity: .slow, thenHoldForDuration: 0.2)
        }
        expect(jump, "exists == true AND hittable == true", "scrolled away: the jump circle shows")
        settle()
        let expandedGap = field.frame.minY - jump.frame.maxY
        let expandedDiag = "field \(field.frame) jump \(jump.frame) \(jump.value as? String ?? "-")"
        attach(app, "toolbar-expanded")

        // A short finger-up drag collapses the toolbar into its pill and stays
        // far from the bottom, so the circle stays.
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55))
            .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.45)),
                   withVelocity: .slow, thenHoldForDuration: 0.2)
        settle()
        expect(jump, "exists == true", "still away from the bottom")
        let collapsedGap = field.frame.minY - jump.frame.maxY
        let collapsedDiag = "field \(field.frame) jump \(jump.frame) \(jump.value as? String ?? "-")"
        print("CMUX10-DIAG expanded: \(expandedDiag)")
        print("CMUX10-DIAG collapsed: \(collapsedDiag)")
        attach(app, "toolbar-collapsed")

        let window = app.windows.firstMatch.frame
        XCTFail("CMUX10-DIAG window \(window) | EXPANDED gap \(expandedGap): \(expandedDiag) | COLLAPSED gap \(collapsedGap): \(collapsedDiag)")
        XCTAssertGreaterThan(expandedGap, 0, "the circle never overlaps the composer field (expanded)")
        XCTAssertGreaterThan(collapsedGap, 0, "the circle never overlaps the composer field (collapsed)")
        XCTAssertLessThan(collapsedGap, 30, "with the pill the circle sits just above the composer, not \(collapsedGap) pt away")
        XCTAssertLessThan(expandedGap, 30, "with the toolbar the circle sits just above the composer, not \(expandedGap) pt away")
        XCTAssertEqual(collapsedGap, expandedGap, accuracy: 4, "the same gap in both toolbar states")
    }

    /// The toolbar's collapse runs a short spring; let it land.
    @MainActor
    private func settle() {
        _ = XCTWaiter().wait(for: [XCTestExpectation(description: "settle")], timeout: 0.8)
    }

    @MainActor
    private func expect(_ element: XCUIElement, _ predicate: String, _ message: String) {
        let expectation = XCTNSPredicateExpectation(predicate: NSPredicate(format: predicate), object: element)
        XCTAssertEqual(XCTWaiter().wait(for: [expectation], timeout: 10), .completed, message)
    }

    @MainActor
    private func attach(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
