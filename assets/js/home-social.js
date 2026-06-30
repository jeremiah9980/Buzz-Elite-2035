(() => {
  const INSTAGRAM_PROFILE = 'https://www.instagram.com/ctxbombersmeza/';
  const FACEBOOK_REELS = 'https://www.facebook.com/profile.php?id=61583868568607&sk=reels_tab';
  const FACEBOOK_PROFILE = 'https://www.facebook.com/profile.php?id=61583868568607';

  function instagramEmbed(containerId, profileUrl, label) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const quote = document.createElement('blockquote');
    quote.className = 'instagram-media';
    quote.dataset.instgrmPermalink = `${profileUrl}?utm_source=ig_embed&utm_campaign=loading`;
    quote.dataset.instgrmVersion = '14';
    quote.style.cssText = 'background:#fff;border:0;border-radius:12px;box-shadow:none;margin:0;max-width:540px;min-width:280px;padding:0;width:100%;';

    const fallback = document.createElement('div');
    fallback.className = 'social-embed-fallback';
    fallback.innerHTML = `<div><i class="ti ti-brand-instagram"></i><strong>${label}</strong><p>Instagram will load the live profile viewer here. Privacy settings, browser blockers, or platform limits may prevent the embedded view.</p><a class="social-btn social-btn-instagram" href="${profileUrl}" target="_blank" rel="noopener noreferrer">View Instagram</a></div>`;
    quote.appendChild(fallback);
    container.appendChild(quote);
  }

  function facebookEmbed(containerId, profileUrl, fallbackUrl) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const iframe = document.createElement('iframe');
    const encoded = encodeURIComponent(profileUrl);
    iframe.className = 'social-facebook-frame';
    iframe.title = 'CTX Bombers Meza Facebook reels';
    iframe.loading = 'lazy';
    iframe.src = `https://www.facebook.com/plugins/page.php?href=${encoded}&tabs=timeline&width=500&height=560&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true`;
    iframe.allow = 'autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share';
    iframe.setAttribute('allowfullscreen', 'true');
    container.appendChild(iframe);

    const fallback = document.createElement('div');
    fallback.className = 'social-embed-fallback social-facebook-fallback';
    fallback.innerHTML = `<div><i class="ti ti-brand-facebook"></i><strong>CTX Bombers Meza Reels</strong><p>Facebook will load the live viewer when the profile/page allows embedding. Open Reels directly if the frame does not load.</p><a class="social-btn social-btn-primary" href="${fallbackUrl}" target="_blank" rel="noopener noreferrer">Open Facebook Reels</a></div>`;
    container.appendChild(fallback);
  }

  instagramEmbed('bombers-instagram-embed', INSTAGRAM_PROFILE, 'CTX Bombers Meza on Instagram');
  facebookEmbed('bombers-facebook-embed', FACEBOOK_PROFILE, FACEBOOK_REELS);

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.instagram.com/embed.js';
  script.onload = () => window.instgrm?.Embeds?.process();
  document.body.appendChild(script);
})();
