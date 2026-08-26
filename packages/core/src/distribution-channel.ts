export type DistributionChannelFamily =
  | "PAID_MEDIA" | "ORGANIC_SEARCH" | "EDITORIAL" | "SOCIAL_ORGANIC"
  | "MARKETPLACE" | "LIFECYCLE" | "PARTNERSHIP" | "COMMUNITY"
  | "PR_EARNED" | "LOCAL_OFFLINE";

export type DistributionCostModel = "AUCTION" | "FIXED" | "COMMISSION" | "PRODUCTION_ONLY" | "OWNED";

export interface DistributionChannelDefinition {
  readonly id: string;
  readonly family: DistributionChannelFamily;
  readonly name: string;
  readonly costModel: DistributionCostModel;
  readonly geographicScope: "GLOBAL" | "REGIONAL" | "LOCAL";
  readonly contentCapabilities: readonly string[];
  readonly nativeMetrics: readonly string[];
  readonly requiresProvider: boolean;
}

export const defaultDistributionChannels: readonly DistributionChannelDefinition[] = [
  { id:"meta_ads", family:"PAID_MEDIA", name:"Meta Ads", costModel:"AUCTION", geographicScope:"GLOBAL", contentCapabilities:["static","video","carousel"], nativeMetrics:["spend","impressions","clicks","conversions"], requiresProvider:true },
  { id:"google_ads", family:"PAID_MEDIA", name:"Google Ads", costModel:"AUCTION", geographicScope:"GLOBAL", contentCapabilities:["search_ad","display","video"], nativeMetrics:["spend","search_impression_share","clicks","conversions"], requiresProvider:true },
  { id:"tiktok_ads", family:"PAID_MEDIA", name:"TikTok Ads", costModel:"AUCTION", geographicScope:"GLOBAL", contentCapabilities:["short_video"], nativeMetrics:["spend","views","clicks","conversions"], requiresProvider:true },
  { id:"linkedin_ads", family:"PAID_MEDIA", name:"LinkedIn Ads", costModel:"AUCTION", geographicScope:"GLOBAL", contentCapabilities:["static","video","lead_form"], nativeMetrics:["spend","clicks","leads"], requiresProvider:true },
  { id:"youtube_ads", family:"PAID_MEDIA", name:"YouTube Ads", costModel:"AUCTION", geographicScope:"GLOBAL", contentCapabilities:["video"], nativeMetrics:["spend","views","view_through_conversions"], requiresProvider:true },
  { id:"seo_articles", family:"ORGANIC_SEARCH", name:"SEO Articles", costModel:"PRODUCTION_ONLY", geographicScope:"GLOBAL", contentCapabilities:["article","topic_cluster"], nativeMetrics:["rank","organic_sessions","qualified_events"], requiresProvider:false },
  { id:"local_seo", family:"ORGANIC_SEARCH", name:"Local SEO", costModel:"PRODUCTION_ONLY", geographicScope:"LOCAL", contentCapabilities:["local_page","business_profile"], nativeMetrics:["local_rank","calls","directions","qualified_events"], requiresProvider:true },
  { id:"comparison_pages", family:"ORGANIC_SEARCH", name:"Comparison Pages", costModel:"PRODUCTION_ONLY", geographicScope:"REGIONAL", contentCapabilities:["comparison_page"], nativeMetrics:["rank","organic_sessions","qualified_events"], requiresProvider:false },
  { id:"editorial_articles", family:"EDITORIAL", name:"Editorial Articles", costModel:"PRODUCTION_ONLY", geographicScope:"GLOBAL", contentCapabilities:["article","research","guide"], nativeMetrics:["readers","completion","assisted_events"], requiresProvider:false },
  { id:"instagram_organic", family:"SOCIAL_ORGANIC", name:"Instagram Organic", costModel:"OWNED", geographicScope:"GLOBAL", contentCapabilities:["static","reel","story"], nativeMetrics:["reach","engagement","qualified_events"], requiresProvider:true },
  { id:"tiktok_organic", family:"SOCIAL_ORGANIC", name:"TikTok Organic", costModel:"OWNED", geographicScope:"GLOBAL", contentCapabilities:["short_video"], nativeMetrics:["views","completion","qualified_events"], requiresProvider:true },
  { id:"linkedin_organic", family:"SOCIAL_ORGANIC", name:"LinkedIn Organic", costModel:"OWNED", geographicScope:"GLOBAL", contentCapabilities:["post","article","video"], nativeMetrics:["impressions","engagement","qualified_events"], requiresProvider:true },
  { id:"youtube_channel", family:"SOCIAL_ORGANIC", name:"YouTube Channel", costModel:"PRODUCTION_ONLY", geographicScope:"GLOBAL", contentCapabilities:["video","short_video"], nativeMetrics:["views","watch_time","qualified_events"], requiresProvider:true },
  { id:"reddit_organic", family:"COMMUNITY", name:"Reddit Communities", costModel:"OWNED", geographicScope:"REGIONAL", contentCapabilities:["post","comment","ama"], nativeMetrics:["reach","engagement","qualified_events"], requiresProvider:true },
  { id:"regional_marketplace", family:"MARKETPLACE", name:"Regional Marketplaces", costModel:"COMMISSION", geographicScope:"REGIONAL", contentCapabilities:["listing","offer"], nativeMetrics:["listing_views","inquiries","transactions"], requiresProvider:true },
  { id:"industry_directory", family:"MARKETPLACE", name:"Industry Directories", costModel:"FIXED", geographicScope:"REGIONAL", contentCapabilities:["listing","profile"], nativeMetrics:["profile_views","referrals","qualified_events"], requiresProvider:true },
  { id:"email_lifecycle", family:"LIFECYCLE", name:"Email Lifecycle", costModel:"OWNED", geographicScope:"GLOBAL", contentCapabilities:["email","sequence","newsletter"], nativeMetrics:["delivered","clicks","qualified_events","retention"], requiresProvider:true },
  { id:"push_notifications", family:"LIFECYCLE", name:"Push Notifications", costModel:"OWNED", geographicScope:"GLOBAL", contentCapabilities:["push"], nativeMetrics:["delivered","opens","qualified_events"], requiresProvider:true },
  { id:"referral_program", family:"PARTNERSHIP", name:"Referral Program", costModel:"COMMISSION", geographicScope:"GLOBAL", contentCapabilities:["referral_offer"], nativeMetrics:["invites","qualified_referrals","value_events"], requiresProvider:false },
  { id:"creator_partnerships", family:"PARTNERSHIP", name:"Creator Partnerships", costModel:"FIXED", geographicScope:"REGIONAL", contentCapabilities:["video","post","review"], nativeMetrics:["reach","engagement","qualified_events"], requiresProvider:true },
  { id:"youtube_creator_integrations", family:"PARTNERSHIP", name:"YouTube Creator Integrations", costModel:"FIXED", geographicScope:"REGIONAL", contentCapabilities:["host_read","dedicated_video","review","short_video"], nativeMetrics:["views","watch_time","brand_search_lift","qualified_events"], requiresProvider:true },
  { id:"micro_influencer_network", family:"PARTNERSHIP", name:"Local Micro-Influencers", costModel:"FIXED", geographicScope:"LOCAL", contentCapabilities:["post","story","short_video","event"], nativeMetrics:["local_reach","engagement","qualified_events"], requiresProvider:true },
  { id:"creator_whitelisting", family:"PAID_MEDIA", name:"Creator Whitelisting", costModel:"AUCTION", geographicScope:"REGIONAL", contentCapabilities:["authorized_creator_ad"], nativeMetrics:["spend","reach","qualified_events","incremental_lift"], requiresProvider:true },
  { id:"affiliate_network", family:"PARTNERSHIP", name:"Affiliate Network", costModel:"COMMISSION", geographicScope:"GLOBAL", contentCapabilities:["offer","review","comparison"], nativeMetrics:["clicks","qualified_events","commission"], requiresProvider:true },
  { id:"strategic_partnerships", family:"PARTNERSHIP", name:"Strategic Partnerships", costModel:"FIXED", geographicScope:"REGIONAL", contentCapabilities:["co_marketing","integration"], nativeMetrics:["referred_accounts","qualified_events","revenue"], requiresProvider:false },
  { id:"pr_earned_media", family:"PR_EARNED", name:"PR and Earned Media", costModel:"PRODUCTION_ONLY", geographicScope:"REGIONAL", contentCapabilities:["press_release","research","pitch"], nativeMetrics:["mentions","reach","assisted_events"], requiresProvider:true },
  { id:"community_program", family:"COMMUNITY", name:"Community Program", costModel:"OWNED", geographicScope:"LOCAL", contentCapabilities:["discussion","event","ambassador"], nativeMetrics:["active_members","participation","qualified_events"], requiresProvider:false },
  { id:"webinars", family:"COMMUNITY", name:"Webinars", costModel:"PRODUCTION_ONLY", geographicScope:"GLOBAL", contentCapabilities:["webinar","follow_up"], nativeMetrics:["registrations","attendance","qualified_events"], requiresProvider:true },
  { id:"local_events", family:"LOCAL_OFFLINE", name:"Local Events", costModel:"FIXED", geographicScope:"LOCAL", contentCapabilities:["event","print","sponsorship"], nativeMetrics:["attendance","leads","qualified_events"], requiresProvider:true },
] as const;

export function assertValidDistributionChannelRegistry(channels: readonly DistributionChannelDefinition[]): void {
  if (channels.length === 0) throw new Error("Distribution channel registry cannot be empty");
  const ids = new Set<string>();
  for (const channel of channels) {
    if (!/^[a-z0-9_]+$/.test(channel.id)) throw new Error(`Invalid distribution channel id: ${channel.id}`);
    if (ids.has(channel.id)) throw new Error(`Duplicate distribution channel id: ${channel.id}`);
    if (channel.contentCapabilities.length === 0 || channel.nativeMetrics.length === 0) throw new Error(`Incomplete distribution channel: ${channel.id}`);
    ids.add(channel.id);
  }
}
