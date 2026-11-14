// Siri & Shortcuts (App Shortcuts): "Add an expense in Gloslate", "What do I owe in
// Gloslate", "Settle up in Gloslate". Each one opens a screen in the app through its
// own link (tabitat://…), so the JS side needs nothing new. Added to the app target by
// plugins/with-app-shortcuts.js. iOS 18+ (OpenURLIntent); older iOS just won't list them.
import AppIntents
import Foundation

@available(iOS 18.0, *)
struct GloslateAddExpense: AppIntent {
  static let title: LocalizedStringResource = "Add an expense"
  static let description = IntentDescription("Opens Gloslate to add an expense.")

  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(URL(string: "tabitat://add")!))
  }
}

@available(iOS 18.0, *)
struct GloslateShowBalance: AppIntent {
  static let title: LocalizedStringResource = "Show my balance"
  static let description = IntentDescription("Opens Gloslate to who owes who.")

  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(URL(string: "tabitat://home")!))
  }
}

@available(iOS 18.0, *)
struct GloslateSettleUp: AppIntent {
  static let title: LocalizedStringResource = "Settle up"
  static let description = IntentDescription("Opens Gloslate to your balances with friends.")

  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(URL(string: "tabitat://groups")!))
  }
}

@available(iOS 18.0, *)
struct GloslateShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: GloslateAddExpense(),
      phrases: ["Add an expense in \(.applicationName)", "Split something in \(.applicationName)", "Add to \(.applicationName)"],
      shortTitle: "Add an expense",
      systemImageName: "plus.circle"
    )
    AppShortcut(
      intent: GloslateShowBalance(),
      phrases: ["What do I owe in \(.applicationName)", "Check my \(.applicationName) balance", "Show my balance in \(.applicationName)"],
      shortTitle: "My balance",
      systemImageName: "dollarsign.circle"
    )
    AppShortcut(
      intent: GloslateSettleUp(),
      phrases: ["Settle up in \(.applicationName)", "Who owes me in \(.applicationName)"],
      shortTitle: "Settle up",
      systemImageName: "checkmark.circle"
    )
  }
}
