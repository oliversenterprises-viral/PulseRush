/**
 * AdMob on native Capacitor. Web uses a fair continue (one free revive)
 * so the loop can be tested without an AdMob account.
 * Swap TEST ids in native/config.json when the AdMob app is live.
 */

export const TEST_IDS = Object.freeze({
  appId: "ca-app-pub-3940256099942544~3347511713",
  banner: "ca-app-pub-3940256099942544/6300978111",
  interstitial: "ca-app-pub-3940256099942544/1033173712",
  rewarded: "ca-app-pub-3940256099942544/5224354917",
});

const INTERSTITIAL_EVERY = 3;
const INTERSTITIAL_GAP_MS = 90_000;

export class AdBridge {
  constructor() {
    this.native = false;
    this.ready = false;
    this.plugin = null;
    this.lastInterstitial = 0;
    this.rewardedReady = false;
  }

  async init() {
    try {
      const cap = window.Capacitor;
      if (!cap?.isNativePlatform?.()) return;
      const mod = await import("@capacitor-community/admob");
      this.plugin = mod.AdMob;
      this.native = true;
      await this.plugin.initialize({ requestTrackingAuthorization: false });
      try {
        const info = await this.plugin.requestConsentInfo();
        if (info?.isConsentFormAvailable && String(info.status).includes("REQUIRED")) {
          await this.plugin.showConsentForm();
        }
      } catch {
        /* consent optional until AdMob UMP is configured */
      }
      this.ready = true;
      this.preload();
    } catch {
      this.native = false;
      this.ready = false;
    }
  }

  async preload() {
    if (!this.plugin) return;
    try {
      await this.plugin.prepareInterstitial({ adId: TEST_IDS.interstitial });
    } catch {
      /* ignore */
    }
    try {
      await this.plugin.prepareRewardVideoAd({ adId: TEST_IDS.rewarded });
      this.rewardedReady = true;
    } catch {
      this.rewardedReady = false;
    }
  }

  async showRewarded() {
    if (!this.native || !this.plugin) {
      return { earned: true, source: "web-grant" };
    }
    try {
      await this.plugin.showRewardVideoAd();
      this.rewardedReady = false;
      this.plugin.prepareRewardVideoAd({ adId: TEST_IDS.rewarded }).catch(() => {});
      return { earned: true, source: "admob" };
    } catch {
      return { earned: false, source: "failed" };
    }
  }

  shouldInterstitial(state) {
    if (state.adsRemoved) return false;
    if ((state.gamesSinceInterstitial || 0) < INTERSTITIAL_EVERY) return false;
    return Date.now() - this.lastInterstitial >= INTERSTITIAL_GAP_MS;
  }

  async showInterstitial(state) {
    if (!this.shouldInterstitial(state)) return false;
    if (!this.native || !this.plugin) {
      this.lastInterstitial = Date.now();
      return false;
    }
    try {
      await this.plugin.showInterstitial();
      this.lastInterstitial = Date.now();
      this.plugin.prepareInterstitial({ adId: TEST_IDS.interstitial }).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }
}
