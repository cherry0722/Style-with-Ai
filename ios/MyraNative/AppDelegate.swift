import UIKit
import CoreText
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  /// Registers `Ionicons.ttf` before React Native starts.
  /// TEMPORARY: verbose logging for iOS 26 icon debugging — remove after diagnosis.
  private static func registerBundledIoniconsFont() {
    let tag = "[MYRA-FONT-DIAG]"

    guard let url = Bundle.main.url(forResource: "Ionicons", withExtension: "ttf") else {
      print("\(tag) ❌ Ionicons.ttf NOT FOUND in Bundle.main")
      print("\(tag)    Bundle path: \(Bundle.main.bundlePath)")
      return
    }
    print("\(tag) ✅ Ionicons.ttf found: \(url.path)")

    var error: Unmanaged<CFError>?
    if CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) {
      print("\(tag) ✅ CTFontManager registered Ionicons.ttf successfully")
    } else if let errRef = error?.takeRetainedValue() {
      let code = CFErrorGetCode(errRef)
      let desc = CFErrorCopyDescription(errRef) as String? ?? "unknown"
      if code == Int(CTFontManagerError.alreadyRegistered.rawValue) {
        print("\(tag) ⚠️  Ionicons.ttf already registered (code \(code)) — OK")
      } else {
        print("\(tag) ❌ CTFontManager FAILED — code \(code): \(desc)")
      }
    } else {
      print("\(tag) ❌ CTFontManager FAILED — no error object returned")
    }

    if let testFont = UIFont(name: "Ionicons", size: 12) {
      print("\(tag) ✅ UIFont(name: \"Ionicons\") resolved: \(testFont.fontName)")
    } else {
      print("\(tag) ❌ UIFont(name: \"Ionicons\") returned nil — font family NOT recognized")
      print("\(tag)    All registered families containing 'Icon':")
      for family in UIFont.familyNames where family.lowercased().contains("icon") {
        print("\(tag)      family: \(family) → \(UIFont.fontNames(forFamilyName: family))")
      }
    }
  }

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    Self.registerBundledIoniconsFont()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "MyraNative",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
