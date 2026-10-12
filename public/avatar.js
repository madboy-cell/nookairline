/**
 * Nook Airline — 2D Maple Sky Lounge & Chibi Avatar Engine
 * Lightweight, zero-battery-drain SVG & CSS animation system.
 */

// Authentic MapleStory Characters & Airline Uniforms
const MAPLE_CHARACTERS = {
  got_queen: {
    id: 'got_queen',
    name: 'Khaleesi of DXB 🐉👑',
    subtitle: 'Winterfell White Fur & Baby Dragon',
    badge: 'DXB Default',
    sprite: 'assets/got_queen.png'
  },
  emirates_crew: {
    id: 'emirates_crew',
    name: 'Air Emirates 🇦🇪',
    subtitle: 'Dubai Cabin Crew Uniform',
    badge: 'Dubai Crew',
    sprite: 'assets/emirates_crew.png'
  },
  bkk_guy: {
    id: 'bkk_guy',
    name: 'Lord of BKK 🐺⚔️',
    subtitle: 'Winterfell Stark Armor & Longclaw',
    badge: 'BKK Default',
    sprite: 'assets/bkk_warrior_idle.png',
    walkSprite: 'assets/bkk_warrior_walk.png',
    slashSprite: 'assets/bkk_warrior_slash.png'
  },
  bkk_casual: {
    id: 'bkk_casual',
    name: 'BKK Casual 🇹🇭',
    subtitle: 'Streetwear Hoodie & Denim',
    badge: 'Streetwear',
    sprite: 'assets/bkk_casual.png'
  },
  pilot_captain: {
    id: 'pilot_captain',
    name: 'Flight Captain 👨‍✈️',
    subtitle: 'Navy Aviation Wings Suit',
    badge: 'First Class',
    sprite: 'assets/pilot_captain.png'
  },
  thai_crew: {
    id: 'thai_crew',
    name: 'Thai Silk Crew 🌸',
    subtitle: 'Royal Silk Traditional Dress',
    badge: 'BKK Silk',
    sprite: 'assets/thai_crew.png'
  },
  surfer_guy: {
    id: 'surfer_guy',
    name: 'Wave Rider 🏄‍♂️',
    subtitle: 'Boardshorts & Surfboard',
    badge: 'Beach Vibes',
    sprite: 'assets/surfer_guy.png'
  },
  surfer_girl: {
    id: 'surfer_girl',
    name: 'Island Surfer 🏄‍♀️',
    subtitle: 'Hibiscus & Wave Board',
    badge: 'Tropical',
    sprite: 'assets/surfer_girl.png'
  },
  winter_guy: {
    id: 'winter_guy',
    name: 'Alpine Hiker 🏂',
    subtitle: 'Ski Puffer & Hot Cocoa',
    badge: 'Winter Ski',
    sprite: 'assets/winter_guy.png'
  },
  winter_girl: {
    id: 'winter_girl',
    name: 'Cozy Snowbell ❄️',
    subtitle: 'Pastel Puffer & Warm Earmuffs',
    badge: 'Winter Ski',
    sprite: 'assets/winter_girl.png'
  },
  pajama_guy: {
    id: 'pajama_guy',
    name: 'First Class Sleeper 🌙',
    subtitle: 'Navy Silk Pajamas & Eye Mask',
    badge: 'Sleepwear',
    sprite: 'assets/pajama_guy.png'
  },
  pajama_girl: {
    id: 'pajama_girl',
    name: 'Dreamy First Class ✨',
    subtitle: 'Rose Gold Silk & Cloud Slippers',
    badge: 'Sleepwear',
    sprite: 'assets/pajama_girl.png'
  },
  cyber_guy: {
    id: 'cyber_guy',
    name: 'Cyber Pilot ⚡',
    subtitle: 'Neon Visor & Tech Bomber',
    badge: 'Cyberpunk',
    sprite: 'assets/cyber_guy.png'
  },
  cyber_girl: {
    id: 'cyber_girl',
    name: 'Cyber Navigator 🔮',
    subtitle: 'Holo Visor & Flight Data Pad',
    badge: 'Cyberpunk',
    sprite: 'assets/cyber_girl.png'
  },
  desert_prince: {
    id: 'desert_prince',
    name: 'Desert Mirage Prince 🏜️',
    subtitle: 'Golden Brocade & Royal Scimitar',
    badge: 'Arabian Night',
    sprite: 'assets/desert_prince.png'
  },
  desert_princess: {
    id: 'desert_princess',
    name: 'Desert Dune Princess 👑',
    subtitle: 'Emerald Chiffon & Gold Henna',
    badge: 'Arabian Night',
    sprite: 'assets/desert_princess.png'
  },
  barista_guy: {
    id: 'barista_guy',
    name: 'Bangkok Artisan Roaster ☕',
    subtitle: 'Leather Apron & Pour-Over Kettle',
    badge: 'Cafe Culture',
    sprite: 'assets/barista_guy.png'
  },
  chocolate_girl: {
    id: 'chocolate_girl',
    name: 'Dubai Chocolatier 🍫',
    subtitle: 'Pistachio Knafeh & Gold Dust',
    badge: 'Gourmet Treats',
    sprite: 'assets/chocolate_girl.png'
  },
  masquerade_guy: {
    id: 'masquerade_guy',
    name: 'Venetian Phantom 🎭',
    subtitle: 'Gold Filigree Mask & Velvet Cloak',
    badge: 'Masquerade',
    sprite: 'assets/masquerade_guy.png'
  },
  masquerade_girl: {
    id: 'masquerade_girl',
    name: 'Crimson Belladonna 🌹',
    subtitle: 'Swan Feather Mask & Corset Gown',
    badge: 'Masquerade',
    sprite: 'assets/masquerade_girl.png'
  },
  starfleet_guy: {
    id: 'starfleet_guy',
    name: 'Starfleet Commander 🚀',
    subtitle: 'Retro Space Suit & Gravity Boots',
    badge: 'Cosmic Journey',
    sprite: 'assets/starfleet_guy.png'
  },
  starfleet_girl: {
    id: 'starfleet_girl',
    name: 'Astral Navigator 🌌',
    subtitle: 'Iridescent Suit & Star Map Orrery',
    badge: 'Cosmic Journey',
    sprite: 'assets/starfleet_girl.png'
  },
  cottage_guy: {
    id: 'cottage_guy',
    name: 'Forest Herbalist 🌿',
    subtitle: 'Earth Linen, Satchel & Rare Flora',
    badge: 'Cottagecore',
    sprite: 'assets/cottage_guy.png'
  },
  cottage_girl: {
    id: 'cottage_girl',
    name: 'Meadow Baker 🍓',
    subtitle: 'Gingham Dress & Fresh Pastry Basket',
    badge: 'Cottagecore',
    sprite: 'assets/cottage_girl.png'
  },
  yukata_guy: {
    id: 'yukata_guy',
    name: 'Matsuri Traveler 🏮',
    subtitle: 'Indigo Yukata & Fox Kitsune Mask',
    badge: 'Matsuri Night',
    sprite: 'assets/yukata_guy.png'
  },
  yukata_girl: {
    id: 'yukata_girl',
    name: 'Sakura Goldfish Belle 🌸',
    subtitle: 'Blossom Furisode & Wagasa Parasol',
    badge: 'Matsuri Night',
    sprite: 'assets/yukata_girl.png'
  },
  steampunk_guy: {
    id: 'steampunk_guy',
    name: 'Airship Captain ⚙️',
    subtitle: 'Brass Goggles & Leather Trench',
    badge: 'Steampunk',
    sprite: 'assets/steampunk_guy.png'
  },
  steampunk_girl: {
    id: 'steampunk_girl',
    name: 'Wind Cartographer 🧭',
    subtitle: 'Clockwork Sextant & Brass Wings',
    badge: 'Steampunk',
    sprite: 'assets/steampunk_girl.png'
  },
  kigurumi_bear: {
    id: 'kigurumi_bear',
    name: 'Sleepy Bear Onesie 🐻',
    subtitle: 'Fluffy Teddy Hood & Honey Jar',
    badge: 'Pajama Party',
    sprite: 'assets/kigurumi_bear.png'
  },
  kigurumi_bunny: {
    id: 'kigurumi_bunny',
    name: 'Strawberry Bunny Onesie 🐰',
    subtitle: 'Pastel Bunny Ears & Carrot Slipper',
    badge: 'Pajama Party',
    sprite: 'assets/kigurumi_bunny.png'
  },
  tuxedo_guy: {
    id: 'tuxedo_guy',
    name: 'Met Gala Sovereign 🍸',
    subtitle: 'Midnight Velvet Tuxedo & Champagne',
    badge: 'Haute Couture',
    sprite: 'assets/tuxedo_guy.png'
  },
  gala_girl: {
    id: 'gala_girl',
    name: 'Liquid Gold Burj Diva ✨',
    subtitle: 'Gilded Starlight Gown & Cat-Eye Shades',
    badge: 'Haute Couture',
    sprite: 'assets/gala_girl.png'
  }
};

// Classic outfits are free for everyone; tag them so the Vault can tell them apart.
Object.values(MAPLE_CHARACTERS).forEach((c) => {
  c.rarity = c.rarity || 'classic';
  if (c.sprite && !c.sprite.includes('?v=')) {
    c.sprite += '?v=20261012v3';
  }
});

// Merge gacha season costumes (costumes.js) so saved looks & partner sync resolve them.
if (window.NookCostumes) {
  window.NookCostumes.COSTUMES.forEach((c) => {
    MAPLE_CHARACTERS[c.id] = {
      id: c.id,
      name: c.name,
      subtitle: c.subtitle,
      badge: window.NookCostumes.RARITY[c.rarity].label,
      sprite: c.sprite,
      rarity: c.rarity,
      season: c.season
    };
  });
}

// Iconic Worldwide Flight Sceneries & Atmospheres
const CABIN_SCENERIES = {
  winterfell: {
    id: 'winterfell',
    name: 'Winterfell Godswood',
    subtitle: 'Weirwood Tree & Stark Hearth Fire',
    badge: 'Winterfell 🐺❄️',
    thumb: 'assets/scenes/winterfell_thumb.jpg',
    wide: 'assets/scenes/winterfell_wide.jpg',
    mood: 'Ancient northern stone castle sanctuary with glowing red Weirwood leaves, Direwolf banners, and crackling braziers.'
  },
  classic: {
    id: 'classic',
    name: 'Royal First Class',
    subtitle: 'Classic Sky Party Lounge',
    badge: 'Classic ✈️',
    thumb: 'assets/scenes/classic_thumb.jpg',
    wide: 'assets/scenes/classic_wide.jpg',
    mood: 'Cream & gold first-class suite with pink sunset clouds outside the windows.'
  },
  kyoto: {
    id: 'kyoto',
    name: 'Kyoto Sakura Shrine',
    subtitle: 'Torii Gate & Mount Fuji Sunset',
    badge: 'Kyoto 🇯🇵',
    thumb: 'assets/scenes/kyoto_thumb.jpg',
    wide: 'assets/scenes/kyoto_wide.jpg',
    mood: 'Cherry-blossom shrine with a glowing stone lantern beneath Mount Fuji at sunset.'
  },
  santorini: {
    id: 'santorini',
    name: 'Santorini Cliffside',
    subtitle: 'Aegean Sunset Terrace',
    badge: 'Greece 🇬🇷',
    thumb: 'assets/scenes/santorini_thumb.jpg',
    wide: 'assets/scenes/santorini_wide.jpg',
    mood: 'Whitewashed cliffside villas with blue domes overlooking the sparkling sea.'
  },
  paris: {
    id: 'paris',
    name: 'Paris Seine Riverfront',
    subtitle: 'Eiffel Tower Night Glow',
    badge: 'Paris 🇫🇷',
    thumb: 'assets/scenes/paris_thumb.jpg',
    wide: 'assets/scenes/paris_wide.jpg',
    mood: 'Romantic cobblestone promenade with vintage street lamps under starlit skies.'
  },
  maldives: {
    id: 'maldives',
    name: 'Maldives Overwater Boardwalk',
    subtitle: 'Turquoise Paradise Sunset',
    badge: 'Maldives 🇲🇻',
    thumb: 'assets/scenes/maldives_thumb.jpg',
    wide: 'assets/scenes/maldives_wide.jpg',
    mood: 'Crystal lagoon boardwalk and swaying palms beneath vibrant tropical skies.'
  },
  swiss: {
    id: 'swiss',
    name: 'Swiss Zermatt Village',
    subtitle: 'Matterhorn & Milky Way Night',
    badge: 'Swiss Alps 🇨🇭',
    thumb: 'assets/scenes/swiss_thumb.jpg',
    wide: 'assets/scenes/swiss_wide.jpg',
    mood: 'Snowy alpine village chalets under the starry Matterhorn night sky.'
  },
  dubai: {
    id: 'dubai',
    name: 'Dubai Desert Oasis',
    subtitle: 'Golden Dunes & Burj Mirage',
    badge: 'Dubai 🏜️✨',
    thumb: 'assets/scenes/dubai_thumb.jpg',
    wide: 'assets/scenes/dubai_wide.jpg',
    mood: 'Enchanting golden desert dunes under starlit Arabian skies with glowing brass lanterns, Persian majlis lounge, and distant Burj Khalifa.'
  },
  montecarlo: {
    id: 'montecarlo',
    name: 'Monte Carlo Penthouse',
    subtitle: 'Casino Palace & Riviera Harbor',
    badge: 'Monaco 🎰🇲🇨',
    thumb: 'assets/scenes/montecarlo_thumb.jpg',
    wide: 'assets/scenes/montecarlo_wide.jpg',
    mood: 'Glamorous private casino penthouse terrace with velvet armchairs and glowing candelabras overlooking the illuminated Monte Carlo palace and superyacht bay.'
  },
  atlantis: {
    id: 'atlantis',
    name: 'Atlantis Undersea Palace',
    subtitle: 'Sunken Spires & Bioluminescent Reefs',
    badge: 'Atlantis 🔱💎',
    thumb: 'assets/scenes/atlantis_thumb.jpg',
    wide: 'assets/scenes/atlantis_wide.jpg',
    mood: 'Atmospheric sunken observation salon overlooking glowing crystal palace spires, luminous coral reefs, and drifting jellyfish schools.'
  },
  starlight: {
    id: 'starlight',
    name: 'Starlight Celestial Observatory',
    subtitle: 'Cosmic Galaxy & Stardust Spire',
    badge: 'Starlight 🌌✨',
    thumb: 'assets/scenes/starlight_thumb.jpg',
    wide: 'assets/scenes/starlight_wide.jpg',
    mood: 'Majestic open-air glass dome observatory suspended among swirling nebulae, glowing constellations, shooting stars, and radiant golden zodiac rings.'
  },
  fairytale: {
    id: 'fairytale',
    name: 'Enchanted Fairytale Kingdom',
    subtitle: 'Royal Palace Balcony & Floating Sky Lanterns',
    badge: 'Fairytale 🏰✨',
    thumb: 'assets/scenes/fairytale_thumb.jpg',
    wide: 'assets/scenes/fairytale_wide.jpg',
    mood: 'Majestic fairytale castle balcony under a twilight lavender sky filled with thousands of glowing floating lanterns, distant crystal spires, and glowing rose gardens.'
  },
  permafrost: {
    id: 'permafrost',
    name: 'Glacial Aurora Sanctum',
    subtitle: 'Ice Palace Balcony & Nordic Aurora',
    badge: 'Glacial ❄️✨',
    thumb: 'assets/scenes/permafrost_thumb.jpg',
    wide: 'assets/scenes/permafrost_wide.jpg',
    mood: 'Breathtaking glacial throne terrace overlooking crystalline ice spires, glowing frozen bridges, and vibrant emerald-cyan aurora borealis.'
  },
  luxor: {
    id: 'luxor',
    name: 'Luxor Palace Terrace',
    subtitle: 'Golden Nile & Great Pyramids Sunset',
    badge: 'Egypt 🏺☀️',
    thumb: 'assets/scenes/s9_luxor_thumb.jpg',
    wide: 'assets/scenes/s9_luxor_wide.jpg',
    mood: 'Opulent royal Egyptian palace terrace in Luxor overlooking the golden Nile river and the distant Great Pyramids at radiant sunset with warm brass lanterns.'
  },
  venice: {
    id: 'venice',
    name: 'Venetian Gothic Balcony',
    subtitle: 'Grand Canal & St. Mark Midnight Moon',
    badge: 'Venice 🎭🥀',
    thumb: 'assets/scenes/s10_venice_thumb.jpg',
    wide: 'assets/scenes/s10_venice_wide.jpg',
    mood: 'Lavish Gothic palazzo terrace overlooking the mist-shrouded Grand Canal of Venice at midnight with floating lantern gondolas, velvet seating, and candle candelabras.'
  },
  olympus: {
    id: 'olympus',
    name: 'Mount Olympus Peristyle',
    subtitle: 'Celestial Pantheon & Elysian Dawn',
    badge: 'Olympus ⚡🏛️',
    thumb: 'assets/scenes/s11_olympus_thumb.jpg',
    wide: 'assets/scenes/s11_olympus_wide.jpg',
    mood: 'Majestic open-air white marble temple terrace on the summit of Mount Olympus overlooking cascading waterfalls, floating Elysian sanctuaries, and divine golden lightning auroras.'
  }
};

let currentSceneryTheme = 'winterfell';
try {
  const savedScenery = localStorage.getItem('nook_cabin_scenery');
  if (savedScenery && CABIN_SCENERIES[savedScenery] && savedScenery !== 'classic') {
    currentSceneryTheme = savedScenery;
  } else {
    currentSceneryTheme = 'winterfell';
  }
} catch (_) {}
let previewSceneryTheme = currentSceneryTheme;

// Detect active terminal role from character base or URL
function getTerminalRole() {
  if (window.SkySupabase && typeof window.SkySupabase.getCharacterBase === 'function') {
    const base = window.SkySupabase.getCharacterBase();
    if (base === 'bkk' || base === 'dxb') return base;
  }
  const localBase = typeof localStorage !== 'undefined' ? localStorage.getItem('sky_active_persona') : null;
  if (localBase === 'bkk' || localBase === 'dxb') return localBase;
  const path = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  if (path.includes('/dxb') || params.get('terminal') === 'dxb') return 'dxb';
  return 'bkk';
}

// Generate Default Avatar based on DXB vs BKK requirements:
// DXB defaults to Game of Thrones Khaleesi/Dragon Queen; BKK defaults to Stark warrior with sword & fur mantle.
function getDefaultAvatar(isMe) {
  const myRole = getTerminalRole();
  const isDxb = isMe ? (myRole === 'dxb') : (myRole !== 'dxb');

  if (isDxb) {
    return {
      characterId: 'got_queen',
      sprite: 'assets/got_queen.png',
      name: 'Khaleesi of DXB 🐉👑',
      role: 'DXB',
      x: 68,
      y: 58,
      facing: 'left'
    };
  } else {
    return {
      characterId: 'bkk_guy',
      sprite: 'assets/bkk_warrior_idle.png',
      walkSprite: 'assets/bkk_warrior_walk.png',
      slashSprite: 'assets/bkk_warrior_slash.png',
      name: 'Lord of BKK 🐺⚔️',
      role: 'BKK',
      x: 32,
      y: 58,
      facing: 'right'
    };
  }
}

// Local State
let myAvatar = loadSavedAvatar();
let partnerAvatar = getDefaultAvatar(false);
let previewAvatar = { ...myAvatar };
let lastInteractionTime = Date.now();
let myWanderTimer = null;
let partnerWanderTimer = null;
let isHugInProgress = false;

// Load saved wardrobe from localStorage with terminal-specific defaults
function loadSavedAvatar() {
  const defaultMe = getDefaultAvatar(true);
  try {
    const saved = localStorage.getItem('nook_avatar_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      // If DXB previously had emirates_crew saved as old default, upgrade to new GoT default
      if (defaultMe.role === 'DXB' && parsed.characterId === 'emirates_crew') {
        return defaultMe;
      }
      // Reset coordinates if saved outside cabin carpet walking bounds
      if (!parsed.y || parsed.y > 66 || parsed.y < 52) parsed.y = defaultMe.y;
      if (!parsed.x || parsed.x > 84 || parsed.x < 16) parsed.x = defaultMe.x;
      // If user had an invalid/legacy characterId, reset to valid character
      if (!parsed.characterId || !MAPLE_CHARACTERS[parsed.characterId]) {
        return defaultMe;
      }
      const charConfig = MAPLE_CHARACTERS[parsed.characterId];
      parsed.sprite = charConfig.sprite;
      parsed.walkSprite = charConfig.walkSprite || null;
      parsed.slashSprite = charConfig.slashSprite || null;
      parsed.name = charConfig.name;
      return { ...defaultMe, ...parsed };
    }
  } catch (e) {
    console.warn('[Avatar] Failed to load saved wardrobe', e);
  }
  return defaultMe;
}

function saveAvatarConfig(avatarConfig) {
  try {
    localStorage.setItem('nook_avatar_config', JSON.stringify(avatarConfig));
  } catch (e) {}
}

// Render Avatar HTML: Authentic MapleStory Chibi Sprite with Multi-Frame Support
function renderAvatarHTML(avatar, isPreview = false) {
  const previewClass = isPreview ? 'preview' : '';
  const charConfig = (avatar.characterId && MAPLE_CHARACTERS[avatar.characterId]) || MAPLE_CHARACTERS.bkk_guy;
  const spriteSrc = avatar.sprite || (charConfig && charConfig.sprite) || 'assets/bkk_warrior_idle.png';
  const walkSrc = avatar.walkSprite || (charConfig && charConfig.walkSprite);
  const slashSrc = avatar.slashSprite || (charConfig && charConfig.slashSprite);
  const hasWalkClass = walkSrc ? 'has-walk' : '';
  const hasSlashClass = slashSrc ? 'has-slash' : '';
  const rarity = (charConfig && charConfig.rarity) || 'classic';
  const rarityClass = rarity !== 'classic' ? `costume-aura aura-${rarity}` : '';

  return `
    <div class="maple-sprite-container ${previewClass} ${hasWalkClass} ${hasSlashClass} ${rarityClass}">
      ${rarityClass ? '<span class="costume-aura-ring"></span><span class="costume-aura-motes"></span>' : ''}
      <img src="${spriteSrc}" class="maple-sprite-img sprite-idle ${previewClass}" alt="${avatar.name || 'Character'}" draggable="false" />
      ${walkSrc ? `<img src="${walkSrc}" class="maple-sprite-img sprite-walk ${previewClass}" alt="Walk" draggable="false" />` : ''}
      ${slashSrc ? `<img src="${slashSrc}" class="maple-sprite-img sprite-slash ${previewClass}" alt="Slash" draggable="false" />` : ''}
    </div>
  `;
}

// Render or Update Avatar in DOM
function renderAvatarDOM(containerId, avatar, isMe = true) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const facingClass = avatar.facing === 'left' ? 'facing-left' : '';
  container.className = `avatar-entity idle ${facingClass}`;
  container.style.left = `${avatar.x}%`;
  container.style.top = `${avatar.y}%`;

  const myProfile = window.SkySupabase ? window.SkySupabase.getProfile() : null;
  const coupleStatus = window.SkySupabase ? window.SkySupabase.coupleStatus : null;
  let tagText = isMe ? 'You' : 'Partner';
  if (isMe && myProfile && myProfile.username) {
    tagText = myProfile.username;
  } else if (!isMe) {
    if (coupleStatus && coupleStatus.isCouple && coupleStatus.partner && coupleStatus.partner.username) {
      tagText = `💞 ${coupleStatus.partner.username}`;
    } else {
      tagText = 'Partner';
    }
  }
  const tagClass = isMe ? 'avatar-tag me' : 'avatar-tag';

  container.innerHTML = `
    <div class="avatar-shadow"></div>
    <div class="avatar-voice-bubble">
      <span>♫</span>
    </div>
    <div class="avatar-emote-bubble" id="${containerId}_emote">
      <span class="emote-bubble-content"></span>
    </div>
    <div class="avatar-body-wrapper">
      ${renderAvatarHTML(avatar, false)}
      <div class="avatar-hug-blush">
        <div class="hug-blush-cheek"></div>
        <div class="hug-blush-cheek"></div>
      </div>
      <div class="avatar-hug-eyes">
        <div class="hug-smile-eye"></div>
        <div class="hug-smile-eye"></div>
      </div>
      <div class="avatar-hug-arm"></div>
    </div>
    <div class="${tagClass}">
      <span class="tag-dot"></span>
      <span>${tagText}</span>
    </div>
  `;
}

// Check if partner is active (linked couple in Supabase or peer connected via signaling)
function isPartnerActive() {
  if (typeof window !== 'undefined' && window.SkySupabase) {
    const cs = window.SkySupabase.coupleStatus;
    if (cs) {
      if (!cs.isCouple) return false;
      return window.nookPartnerOnline === true;
    }
    if (typeof window.SkySupabase.isCouple === 'function' && !window.SkySupabase.isCouple()) {
      return false;
    }
  }

  // Fallback for legacy direct terminal testing via URL (?terminal=bkk / ?terminal=dxb)
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const hasExplicitTerminal = params && (params.has('terminal') || params.has('role'));
  if (hasExplicitTerminal && typeof window !== 'undefined' && window.nookPartnerOnline === true) {
    return true;
  }

  return false;
}

// Update partner presence dynamically (e.g. peer connected, couple linked/unlinked)
function updatePartnerPresence(online) {
  const active = typeof online === 'boolean' ? online : isPartnerActive();
  const partnerEl = document.getElementById('partnerAvatar');

  if (active) {
    if (partnerEl) {
      partnerEl.style.display = '';
      partnerEl.classList.remove('hidden');
      renderAvatarDOM('partnerAvatar', partnerAvatar, false);
      if (Math.abs(myAvatar.x - partnerAvatar.x) < 14) {
        myAvatar.x = 42;
        myAvatar.facing = 'right';
        partnerAvatar.x = 58;
        partnerAvatar.facing = 'left';
        const myEl = document.getElementById('myAvatar');
        if (myEl) {
          myEl.style.left = `${myAvatar.x}%`;
          myEl.className = 'avatar-entity idle';
        }
        partnerEl.style.left = `${partnerAvatar.x}%`;
        partnerEl.className = 'avatar-entity idle facing-left';
      }
      partnerEl.classList.add('happy-bounce');
      setTimeout(() => partnerEl.classList.remove('happy-bounce'), 800);
    }
    if (!partnerWanderTimer) {
      scheduleAvatarWander('partnerAvatar', 2000, 4200);
    }
  } else {
    if (partnerEl) {
      partnerEl.style.display = 'none';
      partnerEl.classList.add('hidden');
    }
    if (partnerWanderTimer) {
      clearTimeout(partnerWanderTimer);
      partnerWanderTimer = null;
    }
  }
}

// Listen to couple status changes from Supabase
if (typeof window !== 'undefined') {
  window.addEventListener('sky:couple_status_changed', () => {
    updatePartnerPresence(isPartnerActive());
    renderAvatarDOM('myAvatar', myAvatar, true);
    if (isPartnerActive()) {
      renderAvatarDOM('partnerAvatar', partnerAvatar, false);
    }
  });
}

// Initialize Sky Lounge Stage & Events
function initAvatarStage() {
  const floor = document.getElementById('loungeFloor');
  if (floor) {
    floor.addEventListener('click', (e) => {
      // If photo mode is active, any tap exits photo mode without moving the avatar!
      const app = document.getElementById('app');
      if (app && (app.classList.contains('photo-mode') || app.classList.contains('menu-hidden'))) {
        if (!window.photoModeCooldown) {
          exitPhotoMode();
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      // Don't trigger if tapping on controls, wardrobe, or avatars
      if (e.target.closest('.emotion-deck') || e.target.closest('.wardrobe-modal') || e.target.closest('.avatar-entity')) return;

      const rect = floor.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Convert to percentage within cabin walking boundaries (16% to 84% X, 54% to 64% Y - on carpet runner & clear of buttons!)
      const xPercent = Math.max(16, Math.min(84, Math.round((clickX / rect.width) * 100)));
      const yPercent = Math.max(54, Math.min(64, Math.round((clickY / rect.height) * 100)));

      // Spawn visual ripple inside floor
      spawnTapRipple(clickX, clickY, floor);

      // Move player avatar
      moveAvatar('myAvatar', myAvatar, xPercent, yPercent, true);

      // Pause player's autonomous wandering for 7 seconds so it rests where tapped
      scheduleAvatarWander('myAvatar', 7000, 10000);
    });
  }

  // Setup Wardrobe Drawer, Scenery Modal & Feelings Deck
  setupWardrobeModal();
  setupSceneryModal();
  setupEmotionButtons();

  // Apply initial saved scenery
  applyCabinScenery(currentSceneryTheme, false);

  const partnerActive = isPartnerActive();

  // In solo flight, gracefully center player avatar if placed near outer edge
  if (!partnerActive && (myAvatar.x <= 36 || myAvatar.x >= 64)) {
    myAvatar.x = 50;
  }

  // Render player avatar
  renderAvatarDOM('myAvatar', myAvatar, true);

  // Render or hide partner avatar depending on solo vs coupled
  const partnerEl = document.getElementById('partnerAvatar');
  if (partnerActive) {
    if (partnerEl) {
      partnerEl.style.display = '';
      partnerEl.classList.remove('hidden');
    }
    renderAvatarDOM('partnerAvatar', partnerAvatar, false);
    scheduleAvatarWander('partnerAvatar', 2400, 3800);
  } else {
    if (partnerEl) {
      partnerEl.style.display = 'none';
      partnerEl.classList.add('hidden');
    }
  }

  // Direct Tap on Avatars (Tap either yourself or partner for a Warm Hug!)
  const myEl = document.getElementById('myAvatar');
  if (myEl) {
    myEl.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerWarmHug(true);
    });
  }
  if (partnerEl) {
    partnerEl.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerWarmHug(true);
    });
  }

  // Start independent autonomous wandering for player avatar
  scheduleAvatarWander('myAvatar', 1200, 2200);
}

// Spawn Cute Tap Ripple
function spawnTapRipple(x, y, parent) {
  const ripple = document.createElement('div');
  ripple.className = 'tap-ripple';
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  parent.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

// Move Avatar to Position with Smooth Natural Walk Cycle
function moveAvatar(containerId, avatarObj, targetX, targetY, isLocal = true) {
  lastInteractionTime = Date.now();
  const el = document.getElementById(containerId);
  if (!el) return;

  // Determine facing direction
  const newFacing = targetX < avatarObj.x ? 'left' : 'right';
  avatarObj.facing = newFacing;
  avatarObj.x = targetX;
  avatarObj.y = targetY;

  el.classList.remove('idle');
  el.classList.add('walking');
  if (newFacing === 'left') {
    el.classList.add('facing-left');
  } else {
    el.classList.remove('facing-left');
  }

  el.style.left = `${targetX}%`;
  el.style.top = `${targetY}%`;

  // After walking transition completes (1100ms)
  setTimeout(() => {
    el.classList.remove('walking');
    el.classList.add('idle');
  }, 1150);

  // If local, broadcast to partner over WebRTC/WebSocket
  if (isLocal && typeof sendSignaling === 'function') {
    sendSignaling({
      type: 'avatar_move',
      x: targetX,
      y: targetY,
      facing: newFacing
    });
  }
}

// Dual-Avatar Autonomous Wandering Engine
function scheduleAvatarWander(avatarId, minDelay = 3000, maxDelay = 6500) {
  const isMe = avatarId === 'myAvatar';
  if (!isMe && !isPartnerActive()) {
    if (partnerWanderTimer) {
      clearTimeout(partnerWanderTimer);
      partnerWanderTimer = null;
    }
    return;
  }
  const delay = Math.round(minDelay + Math.random() * (maxDelay - minDelay));

  const timer = setTimeout(() => {
    runAvatarWanderStep(avatarId);
  }, delay);

  if (isMe) {
    if (myWanderTimer) clearTimeout(myWanderTimer);
    myWanderTimer = timer;
  } else {
    if (partnerWanderTimer) clearTimeout(partnerWanderTimer);
    partnerWanderTimer = timer;
  }
}

function runAvatarWanderStep(avatarId) {
  const isMe = avatarId === 'myAvatar';
  if (!isMe && !isPartnerActive()) return;

  // Save mobile CPU & GPU: pause autonomous wander while modals (Monopoly/Vault) are open or app is in background
  if (document.hidden || document.body.classList.contains('has-active-modal') || (window.monopolyState && window.monopolyState.active)) {
    scheduleAvatarWander(avatarId, 5000, 8000);
    return;
  }

  if (isHugInProgress) {
    scheduleAvatarWander(avatarId, 4000, 6000);
    return;
  }

  const avatarObj = isMe ? myAvatar : partnerAvatar;
  const el = document.getElementById(avatarId);
  if (!el) return;

  // If currently in special emote, pause and check again
  if (el.classList.contains('emoting-hug') || el.classList.contains('emoting-sleep') || el.classList.contains('emoting-dance')) {
    scheduleAvatarWander(avatarId, 3500, 5500);
    return;
  }

  // 25% chance of doing a cute idle flavor gesture instead of walking
  if (Math.random() < 0.25) {
    doCuteIdleFlavor(avatarId);
    scheduleAvatarWander(avatarId, 3200, 5800);
    return;
  }

  // Pick a natural random destination along the luxury airplane carpet runner
  const partnerActive = isPartnerActive();
  let targetX;
  if (!partnerActive) {
    // In solo flight, player wanders freely across center carpet
    targetX = Math.round(24 + Math.random() * 52);
  } else {
    // When coupled, keep natural spacing across the cabin
    targetX = Math.round(18 + Math.random() * 64);
  }
  let targetY = Math.round(55 + Math.random() * 8);

  // Ensure minimum walking distance so it looks like an actual stroll
  const deltaX = Math.abs(targetX - avatarObj.x);
  if (deltaX < 14) {
    targetX = avatarObj.x > 50 ? targetX - 26 : targetX + 26;
    targetX = Math.max(18, Math.min(82, targetX));
  }

  // Stroll avatar to new spot
  moveAvatar(avatarId, avatarObj, targetX, targetY, isMe);

  // Check proximity with partner avatar after arriving (only if partner is active)
  if (partnerActive) {
    setTimeout(() => {
      checkAvatarProximity();
    }, 1150);
  }

  // Schedule next wander step
  scheduleAvatarWander(avatarId, 4500, 8500);
}

// Micro-idle cute gestures (whistle musical note, happy hop, wave, sword flourish, surf splash)
function doCuteIdleFlavor(avatarId) {
  const el = document.getElementById(avatarId);
  if (!el) return;

  const avObj = avatarId === 'myAvatar' ? myAvatar : partnerAvatar;
  const rand = Math.random();

  if (avObj && (avObj.characterId === 'bkk_guy' || avObj.slashSprite) && rand < 0.28) {
    // Warrior dynamic sword flourish & strike practice!
    el.classList.add('slashing');
    showEmoteBubble(avatarId, '⚔️');
    spawnMapleDamage(avObj.x, avObj.y - 12);
    setTimeout(() => el.classList.remove('slashing'), 720);
  } else if (avObj && avObj.characterId && avObj.characterId.includes('surfer') && rand < 0.28) {
    // Surfer tropical wave hop & splash!
    el.classList.add('happy-bounce');
    showEmoteBubble(avatarId, '🌊');
    setTimeout(() => el.classList.remove('happy-bounce'), 600);
  } else if (avObj && avObj.characterId && avObj.characterId.includes('winter') && rand < 0.28) {
    // Winter ski cozy warm bounce & snowflake!
    el.classList.add('happy-bounce');
    showEmoteBubble(avatarId, '❄️');
    setTimeout(() => el.classList.remove('happy-bounce'), 600);
  } else if (avObj && avObj.characterId && avObj.characterId.includes('pajama') && rand < 0.28) {
    // Luxury silk sleepwear soft cloud bounce!
    el.classList.add('happy-bounce');
    showEmoteBubble(avatarId, '☁️');
    setTimeout(() => el.classList.remove('happy-bounce'), 600);
  } else if (avObj && avObj.characterId && avObj.characterId.includes('cyber') && rand < 0.28) {
    // Cyberpunk aviator tech ping & energy spark!
    el.classList.add('happy-bounce');
    showEmoteBubble(avatarId, '⚡');
    setTimeout(() => el.classList.remove('happy-bounce'), 600);
  } else if (rand < 0.5) {
    // Musical note bubble
    showVoiceNoteBubble(avatarId, Math.random() > 0.5 ? '♪' : '♫');
  } else if (rand < 0.8) {
    // Little happy bounce
    el.classList.add('happy-bounce');
    setTimeout(() => el.classList.remove('happy-bounce'), 600);
  } else {
    // Friendly sparkle wave
    showEmoteBubble(avatarId, '✨');
  }
}

// Show voice/song note bubble
function showVoiceNoteBubble(avatarId, note = '♪') {
  const el = document.getElementById(avatarId);
  if (!el) return;
  const bubble = el.querySelector('.avatar-voice-bubble');
  if (bubble) {
    const textSpan = bubble.querySelector('span');
    if (textSpan) textSpan.textContent = note;
    el.classList.add('talking');
    setTimeout(() => {
      el.classList.remove('talking');
      if (textSpan) textSpan.textContent = '♫';
    }, 1400);
  }
}

// Check proximity between both avatars: if close, turn towards each other & share love!
function checkAvatarProximity() {
  if (!isPartnerActive()) return;
  if (isHugInProgress) return;
  const dx = Math.abs(myAvatar.x - partnerAvatar.x);
  const dy = Math.abs(myAvatar.y - partnerAvatar.y);

  if (dx < 18 && dy < 14) {
    const myEl = document.getElementById('myAvatar');
    const partnerEl = document.getElementById('partnerAvatar');

    // Face each other
    if (myAvatar.x < partnerAvatar.x) {
      if (myEl) myEl.classList.remove('facing-left');
      if (partnerEl) partnerEl.classList.add('facing-left');
      myAvatar.facing = 'right';
      partnerAvatar.facing = 'left';
    } else {
      if (myEl) myEl.classList.add('facing-left');
      if (partnerEl) partnerEl.classList.remove('facing-left');
      myAvatar.facing = 'left';
      partnerAvatar.facing = 'right';
    }

    // 45% chance to share a tiny floating heart
    if (Math.random() < 0.45) {
      const midX = (myAvatar.x + partnerAvatar.x) / 2;
      const midY = (myAvatar.y + partnerAvatar.y) / 2;
      spawnHeartExplosion(midX, midY, 2);
    }
  }
}

// =========================================================
// EMOTIONAL SENSORY WARM HUG ENGINE
// =========================================================
let hugTimer = null;
let hugHeartsInterval = null;
let isHugActive = false;

// Solo Flight Cozy Warm Hug / Self-Love Embrace
function triggerSoloWarmHug() {
  const myEl = document.getElementById('myAvatar');
  if (!myEl) return;

  lastInteractionTime = Date.now();
  playHugHeartbeatSound(3200);
  if (navigator.vibrate) {
    try {
      navigator.vibrate([40, 50, 40]);
    } catch (_) {}
  }

  myEl.classList.add('happy-bounce');
  showEmoteBubble('myAvatar', '🥰');
  spawnHeartExplosion(myAvatar.x, myAvatar.y - 12, 3);

  const vignette = document.getElementById('hugScreenVignette');
  if (vignette) {
    vignette.classList.add('active');
    setTimeout(() => vignette.classList.remove('active'), 2400);
  }

  const groundHalo = document.getElementById('hugGroundHalo');
  if (groundHalo) {
    groundHalo.classList.remove('hidden');
    groundHalo.classList.add('active');
    setTimeout(() => {
      groundHalo.classList.remove('active');
      setTimeout(() => groundHalo.classList.add('hidden'), 500);
    }, 2400);
  }

  const toastMsg = '💖 Cozy warm hug! Tap "Copy Link" or link in Couple Sanctuary to share hugs with a partner.';
  if (typeof showToast === 'function') {
    showToast(toastMsg);
  } else if (typeof window.showToast === 'function') {
    window.showToast(toastMsg);
  }

  setTimeout(() => {
    if (myEl) myEl.classList.remove('happy-bounce');
  }, 2200);
}


// Web Audio Physiological Heartbeat & Celestial Warmth Synthesizer
function playHugHeartbeatSound(durationMs = 5200) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!window.hugAudioCtx) {
      window.hugAudioCtx = new AudioCtx();
    }
    const ctx = window.hugAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const startTime = ctx.currentTime;
    const endTime = startTime + (durationMs / 1000);

    // Warm atmospheric swell pad (F major 7 / C major 9 celestial chords)
    const padGain = ctx.createGain();
    padGain.gain.setValueAtTime(0.0001, startTime);
    padGain.gain.linearRampToValueAtTime(0.07, startTime + 1.2);
    padGain.gain.setValueAtTime(0.07, endTime - 0.9);
    padGain.gain.linearRampToValueAtTime(0.0001, endTime);
    padGain.connect(ctx.destination);

    // Frequencies: F3, A3, C4, E4, G4
    [174.61, 220.0, 261.63, 329.63, 392.0].forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.connect(padGain);
      osc.start(startTime);
      osc.stop(endTime);
    });

    // Realistic physiological double heartbeat (lub-dub) every ~1.05s
    const beatInterval = 1.05;
    let t = startTime + 0.3;
    while (t < endTime - 0.4) {
      // Lub: low sine 75Hz -> 48Hz
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(75, t);
      osc1.frequency.exponentialRampToValueAtTime(48, t + 0.12);
      gain1.gain.setValueAtTime(0.24, t);
      gain1.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(t);
      osc1.stop(t + 0.15);

      // Dub: low sine 88Hz -> 58Hz (+160ms)
      const tDub = t + 0.16;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(88, tDub);
      osc2.frequency.exponentialRampToValueAtTime(58, tDub + 0.10);
      gain2.gain.setValueAtTime(0.20, tDub);
      gain2.gain.exponentialRampToValueAtTime(0.0001, tDub + 0.12);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(tDub);
      osc2.stop(tDub + 0.13);

      t += beatInterval;
    }
  } catch (err) {
    console.warn('[HugAudio] notice:', err);
  }
}

// Spawn Gentle Floating Pixel Heart
function spawnCarpetPixelHeart() {
  const container = document.getElementById('hugCarpetHearts');
  if (!container) return;
  const heart = document.createElement('div');
  heart.className = 'hug-pixel-heart';
  const symbols = ['❤️', '💖', '✨', '💕', '🌸', '💫'];
  heart.textContent = symbols[Math.floor(Math.random() * symbols.length)];
  
  const startX = 38 + Math.random() * 26;
  const startY = 65 + Math.random() * 20;
  const dx = (Math.random() - 0.5) * 44;
  
  heart.style.left = `${startX}%`;
  heart.style.top = `${startY}%`;
  heart.style.setProperty('--dx', `${dx}px`);
  
  container.appendChild(heart);
  setTimeout(() => {
    if (heart.parentNode) heart.remove();
  }, 1600);
}

// Trigger Enhanced Emotional Warm Hug (Pure In-World Animation, No Popups)
function triggerWarmHug(isLocal = true) {
  if (isHugActive) return;

  if (!isPartnerActive()) {
    triggerSoloWarmHug();
    return;
  }

  isHugActive = true;
  isHugInProgress = true;
  lastInteractionTime = Date.now();

  // Audio & Haptic sensory feedback (soft heartbeat sound + phone vibration)
  playHugHeartbeatSound(5200);
  if (navigator.vibrate) {
    try {
      navigator.vibrate([40, 60, 50, 90, 40]);
    } catch (_) {}
  }

  // Broadcast to partner over WebSocket
  if (isLocal && typeof sendSignaling === 'function') {
    sendSignaling({
      type: 'avatar_hug',
      action: 'start'
    });
  }

  // 1. Soft Screen Warmth Vignette
  const vignette = document.getElementById('hugScreenVignette');
  if (vignette) vignette.classList.add('active');

  // 2. Both characters walk toward center of floor to meet
  const myEl = document.getElementById('myAvatar');
  const partnerEl = document.getElementById('partnerAvatar');
  const groundHalo = document.getElementById('hugGroundHalo');

  const isMyAvatarOnLeft = (myAvatar.x <= partnerAvatar.x);

  if (isMyAvatarOnLeft) {
    myAvatar.facing = 'right';
    partnerAvatar.facing = 'left';
    moveAvatar('myAvatar', myAvatar, 48.6, 58, false);
    moveAvatar('partnerAvatar', partnerAvatar, 51.4, 58, false);
  } else {
    myAvatar.facing = 'left';
    partnerAvatar.facing = 'right';
    moveAvatar('myAvatar', myAvatar, 51.4, 58, false);
    moveAvatar('partnerAvatar', partnerAvatar, 48.6, 58, false);
  }

  // 3. When they meet (after 1050ms walk):
  clearTimeout(hugTimer);
  hugTimer = setTimeout(() => {
    // Interlocking embrace animation on actual avatars
    if (isMyAvatarOnLeft) {
      if (myEl) {
        myEl.className = 'avatar-entity in-hug in-hug-left';
        myEl.style.left = '48.6%';
        myEl.style.top = '58%';
      }
      if (partnerEl) {
        partnerEl.className = 'avatar-entity in-hug in-hug-right facing-left';
        partnerEl.style.left = '51.4%';
        partnerEl.style.top = '58%';
      }
    } else {
      if (myEl) {
        myEl.className = 'avatar-entity in-hug in-hug-right facing-left';
        myEl.style.left = '51.4%';
        myEl.style.top = '58%';
      }
      if (partnerEl) {
        partnerEl.className = 'avatar-entity in-hug in-hug-left';
        partnerEl.style.left = '48.6%';
        partnerEl.style.top = '58%';
      }
    }

    // Glowing warm halo under couple
    if (groundHalo) {
      groundHalo.classList.remove('hidden');
      groundHalo.classList.add('active');
    }

    // Spawn floating pixel hearts streaming up between them
    clearInterval(hugHeartsInterval);
    hugHeartsInterval = setInterval(spawnCarpetPixelHeart, 260);

    // 4. Automatically complete and gently release after 4.8 seconds
    hugTimer = setTimeout(() => {
      endWarmHug(isLocal);
    }, 4800);
  }, 1050);
}

// End and Release Warm Hug
function endWarmHug(isLocal = true) {
  if (!isHugActive) return;
  isHugActive = false;
  isHugInProgress = false;

  clearTimeout(hugTimer);
  clearInterval(hugHeartsInterval);

  if (isLocal && typeof sendSignaling === 'function') {
    sendSignaling({
      type: 'avatar_hug',
      action: 'end'
    });
  }

  const myEl = document.getElementById('myAvatar');
  const partnerEl = document.getElementById('partnerAvatar');
  const groundHalo = document.getElementById('hugGroundHalo');
  const vignette = document.getElementById('hugScreenVignette');

  if (vignette) vignette.classList.remove('active');
  if (groundHalo) {
    groundHalo.classList.remove('active');
    setTimeout(() => groundHalo.classList.add('hidden'), 500);
  }

  // Avatars step back gently side by side, facing each other smiling
  const isMyAvatarOnLeft = (myAvatar.x <= partnerAvatar.x);
  if (isMyAvatarOnLeft) {
    myAvatar.x = 46;
    myAvatar.facing = 'right';
    partnerAvatar.x = 54;
    partnerAvatar.facing = 'left';
  } else {
    myAvatar.x = 54;
    myAvatar.facing = 'left';
    partnerAvatar.x = 46;
    partnerAvatar.facing = 'right';
  }
  myAvatar.y = 58;
  partnerAvatar.y = 58;

  if (myEl) {
    myEl.style.left = `${myAvatar.x}%`;
    myEl.style.top = `${myAvatar.y}%`;
    myEl.className = `avatar-entity idle ${myAvatar.facing === 'left' ? 'facing-left' : ''}`;
  }
  if (partnerEl) {
    partnerEl.style.left = `${partnerAvatar.x}%`;
    partnerEl.style.top = `${partnerAvatar.y}%`;
    partnerEl.className = `avatar-entity idle ${partnerAvatar.facing === 'left' ? 'facing-left' : ''}`;
  }

  // Show happy blush heart emote bubbles above both avatars
  showEmoteBubble('myAvatar', '🥰');
  showEmoteBubble('partnerAvatar', '🥰');

  // Resume autonomous wandering after 4.5 seconds
  scheduleAvatarWander('myAvatar', 4500, 6500);
  scheduleAvatarWander('partnerAvatar', 5000, 7500);
}

// Backward compatibility fallback
function triggerEmote(emoteName, isLocal = true) {
  triggerWarmHug(isLocal);
}

// Spawn Epic MapleStory Damage / Slash Number
function spawnMapleDamage(xPercent, yPercent) {
  const floor = document.getElementById('loungeFloor');
  if (!floor) return;

  const dmg = document.createElement('div');
  dmg.className = 'maple-damage-pop';
  const dmgValues = ['CRITICAL 999,999', 'CRITICAL 777,777', 'CRITICAL 888,888', 'MAX HIT 999,999'];
  const text = dmgValues[Math.floor(Math.random() * dmgValues.length)];
  dmg.innerHTML = `<span>⚔️</span> ${text}`;
  dmg.style.left = `${xPercent}%`;
  dmg.style.top = `${yPercent}%`;
  floor.appendChild(dmg);
  setTimeout(() => dmg.remove(), 1200);
}

// Show Floating Bubble above Avatar
function showEmoteBubble(avatarId, text) {
  const bubble = document.getElementById(`${avatarId}_emote`);
  if (!bubble) return;
  bubble.querySelector('.emote-bubble-content').textContent = text;
  bubble.classList.add('active');
  setTimeout(() => {
    bubble.classList.remove('active');
  }, 2200);
}

// Spawn Heart Burst for Hug & Proximity (Appended to floor for exact percentage alignment)
function spawnHeartExplosion(centerX, centerY, count = 7) {
  const floor = document.getElementById('loungeFloor');
  if (!floor) return;

  for (let i = 0; i < count; i++) {
    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    heart.textContent = '❤️';
    heart.style.left = `${centerX + (Math.random() * 10 - 5)}%`;
    heart.style.top = `${centerY - 4}%`;
    heart.style.setProperty('--tx', `${(Math.random() * 40 - 20)}px`);
    heart.style.animationDelay = `${i * 0.14}s`;
    floor.appendChild(heart);
    setTimeout(() => heart.remove(), 1800);
  }
}

// Spawn Kiss Heart flying between avatars
function spawnKissHeart(startX, startY, endX, endY) {
  const floor = document.getElementById('loungeFloor');
  if (!floor) return;

  const heart = document.createElement('div');
  heart.className = 'floating-heart';
  heart.textContent = '💖';
  heart.style.left = `${startX}%`;
  heart.style.top = `${startY - 6}%`;
  heart.style.setProperty('--tx', `${(endX - startX) * 4}px`);
  floor.appendChild(heart);
  setTimeout(() => heart.remove(), 1600);
}

// Set Avatar Talking Mouth
function setAvatarTalking(who, isTalking) {
  const el = document.getElementById(who === 'me' ? 'myAvatar' : 'partnerAvatar');
  if (!el) return;
  if (isTalking) {
    el.classList.add('talking');
  } else {
    el.classList.remove('talking');
  }
}

// =========================================================
// PHOTO MODE / HIDE MENU SYSTEM
// =========================================================
let photoModeToastTimer = null;
window.photoModeCooldown = false;

function enterPhotoMode() {
  const app = document.getElementById('app');
  if (!app) return;
  app.classList.add('photo-mode', 'menu-hidden');
  if (typeof triggerHaptic === 'function') triggerHaptic(15);

  // Close modals properly if open so stage is clean
  if (typeof closeWardrobeModal === 'function') closeWardrobeModal();
  if (typeof closeSceneryModal === 'function') closeSceneryModal();
  if (window.NookVault && typeof window.NookVault.close === 'function') {
    try { window.NookVault.close(); } catch (err) {}
  }
  if (window.CatLounge && typeof window.CatLounge.close === 'function') {
    try { window.CatLounge.close(); } catch (err) {}
  }
  const monopolyModal = document.getElementById('monopolyModal');
  if (monopolyModal) monopolyModal.classList.add('hidden');

  // Show gentle toast for 2.4s then fade
  const toast = document.getElementById('photoToast');
  if (toast) {
    toast.classList.remove('hidden', 'toast-fade');
    clearTimeout(photoModeToastTimer);
    photoModeToastTimer = setTimeout(() => {
      toast.classList.add('toast-fade');
      setTimeout(() => toast.classList.add('hidden'), 400);
    }, 2400);
  }

  // Brief guard so the tap initiating photo mode doesn't immediately dismiss
  window.photoModeCooldown = true;
  setTimeout(() => { window.photoModeCooldown = false; }, 320);
}

function exitPhotoMode() {
  const app = document.getElementById('app');
  if (!app) return;
  app.classList.remove('photo-mode', 'menu-hidden');
  if (typeof triggerHaptic === 'function') triggerHaptic(10);
  const toast = document.getElementById('photoToast');
  if (toast) {
    clearTimeout(photoModeToastTimer);
    toast.classList.add('hidden');
  }
}

function togglePhotoMode() {
  const app = document.getElementById('app');
  if (!app) return;
  if (app.classList.contains('photo-mode') || app.classList.contains('menu-hidden')) {
    exitPhotoMode();
  } else {
    enterPhotoMode();
  }
}
window.enterPhotoMode = enterPhotoMode;
window.exitPhotoMode = exitPhotoMode;
window.togglePhotoMode = togglePhotoMode;

// Setup Emotion & Action Deck Buttons
function setupEmotionButtons() {
  const hugBtn = document.getElementById('hugActionBtn');
  if (hugBtn) {
    let isHolding = false;

    const startHold = (e) => {
      e.stopPropagation();
      isHolding = true;
      hugBtn.classList.add('holding');
      triggerWarmHug(true);
      if (typeof triggerHaptic === 'function') triggerHaptic(30);
    };

    const stopHold = (e) => {
      if (isHolding) {
        isHolding = false;
        hugBtn.classList.remove('holding');
      }
    };

    hugBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerWarmHug(true);
    });

    hugBtn.addEventListener('touchstart', startHold, { passive: true });
    hugBtn.addEventListener('touchend', stopHold, { passive: true });
    hugBtn.addEventListener('touchcancel', stopHold, { passive: true });
  }

  const releaseBtn = document.getElementById('hugReleaseBtn');
  if (releaseBtn) {
    releaseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      endWarmHug(true);
    });
  }

  const wardrobeBtn = document.getElementById('openWardrobeBtn');
  if (wardrobeBtn) {
    wardrobeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.NookVault && typeof window.NookVault.open === 'function') window.NookVault.open('wardrobe');
      else openWardrobeModal();
    });
  }

  // Hide Menu / Photo Mode Buttons
  const collapseBtn = document.getElementById('deckCollapseBtn');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      enterPhotoMode();
    });
  }

  const headerPhotoBtn = document.getElementById('flightHeaderPhotoBtn');
  if (headerPhotoBtn) {
    headerPhotoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePhotoMode();
    });
  }

  const exitBtn = document.getElementById('photoModeExitBtn');
  if (exitBtn) {
    exitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exitPhotoMode();
    });
  }

  // Tap anywhere on screen to exit Photo Mode (capturing phase so it runs before any child elements)
  document.addEventListener('click', (e) => {
    const app = document.getElementById('app');
    if (!app || !(app.classList.contains('photo-mode') || app.classList.contains('menu-hidden'))) return;
    if (window.photoModeCooldown) return;
    if (e.target.closest('#photoModeExitBtn')) return;
    exitPhotoMode();
    e.stopPropagation();
    e.preventDefault();
  }, true);

  // Keyboard shortcuts: 'P' or 'H' to toggle photo mode, 'Escape' to exit
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'p' || e.key === 'P' || e.key === 'h' || e.key === 'H') {
      togglePhotoMode();
    } else if (e.key === 'Escape') {
      exitPhotoMode();
    }
  });
}

// =========================================================
// WARDROBE / FITTING ROOM DRAWER
// =========================================================
function setupWardrobeModal() {
  const modal = document.getElementById('wardrobeModal');
  const closeBtn = document.getElementById('closeWardrobeBtn');
  const saveBtn = document.getElementById('saveWardrobeBtn');
  const tabs = document.querySelectorAll('.wardrobe-tab');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeWardrobeModal);
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      myAvatar = { ...previewAvatar };
      saveAvatarConfig(myAvatar);
      renderAvatarDOM('myAvatar', myAvatar, true);
      closeWardrobeModal();

      // Broadcast new character to partner and sync vault profile
      if (typeof sendSignaling === 'function') {
        sendSignaling({
          type: 'avatar_outfit',
          outfit: myAvatar
        });
        sendSignaling({
          type: 'vault_equip',
          costumeId: myAvatar.characterId,
          manual: true
        });
      }

      // Synchronize live loadouts to Monopoly v2 and v1
      if (typeof window.syncMonopolyCostumes === 'function') {
        window.syncMonopolyCostumes();
      } else if (window.NookMonoV2 && typeof window.NookMonoV2.syncLoadout === 'function') {
        window.NookMonoV2.syncLoadout();
      }
      if (typeof updateLobbySeats === 'function') {
        updateLobbySeats();
      }
    });
  }
}

function openWardrobeModal() {
  previewAvatar = { ...myAvatar };
  updateWardrobePreview();
  renderWardrobeOptions();
  const modal = document.getElementById('wardrobeModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('active');
  }
}

function closeWardrobeModal() {
  const modal = document.getElementById('wardrobeModal');
  if (modal) modal.classList.remove('active');
}

function updateWardrobePreview() {
  const previewBox = document.getElementById('previewAvatarBox');
  if (!previewBox) return;
  previewBox.innerHTML = renderAvatarHTML(previewAvatar, true);
}

function renderWardrobeOptions() {
  const container = document.getElementById('wardrobeOptions');
  if (!container) return;

  container.innerHTML = '';

  Object.values(MAPLE_CHARACTERS).forEach((item) => {
    const isSelected = previewAvatar.characterId === item.id;
    const btn = document.createElement('button');
    btn.className = `wardrobe-option-btn character-card ${isSelected ? 'selected' : ''}`;
    
    btn.innerHTML = `
      <img src="${item.sprite}" class="character-thumb" alt="${item.name}" />
      <span class="option-title">${item.name}</span>
      <span class="option-badge">${item.badge}</span>
    `;

    btn.addEventListener('click', () => {
      previewAvatar.characterId = item.id;
      previewAvatar.sprite = item.sprite;
      previewAvatar.walkSprite = item.walkSprite || null;
      previewAvatar.slashSprite = item.slashSprite || null;
      previewAvatar.name = item.name;
      updateWardrobePreview();
      renderWardrobeOptions();
    });

    container.appendChild(btn);
  });
}

// =========================================================
// SCENERY & CABIN ATMOSPHERE MODAL
// =========================================================
function applyCabinScenery(themeId, broadcast = true) {
  if (!CABIN_SCENERIES[themeId]) {
    themeId = 'classic';
  }
  currentSceneryTheme = themeId;
  previewSceneryTheme = themeId;

  const lounge = document.getElementById('skyLounge');
  if (lounge) {
    Object.keys(CABIN_SCENERIES).forEach(k => lounge.classList.remove(`theme-${k}`));
    lounge.classList.add(`theme-${themeId}`);
  }

  // Trigger subtle atmospheric flash
  const flash = document.getElementById('cabinAtmosphereFlash');
  if (flash) {
    flash.classList.remove('flash-active');
    void flash.offsetWidth;
    flash.classList.add('flash-active');
  }

  if (broadcast) {
    try {
      localStorage.setItem('nook_cabin_scenery', themeId);
    } catch (_) {}

    if (typeof sendSignaling === 'function') {
      sendSignaling({
        type: 'scene_change',
        themeId: themeId
      });
    }
  }
}

const SEASON_SCENERIES = [
  { id: 's11', name: 'S11 · Olympus Thunder', themeId: 'olympus', portrait: 'assets/scenes/s11_olympus_portrait.jpg' },
  { id: 's10', name: 'S10 · Phantom Masquerade', themeId: 'venice', portrait: 'assets/scenes/s10_venice_portrait.jpg' },
  { id: 's9',  name: 'S9 · Luxor Terrace', themeId: 'luxor', portrait: 'assets/scenes/s9_luxor_portrait.jpg' },
  { id: 's8',  name: 'S8 · Glacial Royalty', themeId: 'permafrost', portrait: 'assets/scenes/permafrost_portrait.jpg' },
  { id: 's7',  name: 'S7 · Enchanted Fairytales', themeId: 'fairytale', portrait: 'assets/scenes/fairytale_portrait.jpg' },
  { id: 's6',  name: 'S6 · Starlight Odyssey', themeId: 'starlight', portrait: 'assets/scenes/starlight_portrait.jpg' },
  { id: 's5',  name: 'S5 · Atlantis Abyss', themeId: 'atlantis', portrait: 'assets/scenes/atlantis_portrait.jpg' },
  { id: 's4',  name: 'S4 · Monte Carlo Casino', themeId: 'montecarlo', portrait: 'assets/scenes/montecarlo_portrait.jpg' },
  { id: 's3',  name: 'S3 · Dubai Desert', themeId: 'dubai', portrait: 'assets/scenes/dubai_portrait.jpg' },
  { id: 's2',  name: 'S2 · Tokyo Sakura', themeId: 'kyoto', portrait: 'assets/scenes/kyoto_portrait.jpg' },
  { id: 's1',  name: 'S1 · Bangkok Nights', themeId: 'classic', portrait: 'assets/scenes/classic_portrait.jpg' }
];

function previewCabinScenery(themeId) {
  if (!CABIN_SCENERIES[themeId]) return;
  previewSceneryTheme = themeId;

  const lounge = document.getElementById('skyLounge');
  if (lounge) {
    Object.keys(CABIN_SCENERIES).forEach(k => lounge.classList.remove(`theme-${k}`));
    lounge.classList.add(`theme-${themeId}`);
  }

  // Update Hero Preview Window behind cabin frame (high-res panoramic wide image)
  const heroImg = document.getElementById('sceneryHeroPreviewImg');
  if (heroImg && CABIN_SCENERIES[themeId]) {
    heroImg.src = CABIN_SCENERIES[themeId].wide || CABIN_SCENERIES[themeId].thumb;
  }

  renderSceneryGrid();
  renderSeasonSceneryRow();
}

function setupSceneryModal() {
  const openBtn = document.getElementById('openSceneryBtn');
  const closeBtn = document.getElementById('closeSceneryBtn');
  const saveBtn = document.getElementById('saveSceneryBtn');
  const modal = document.getElementById('sceneryModal');
  const backdrop = document.getElementById('sceneryCardBackdrop');
  const previewCabinBtn = document.getElementById('sceneryPreviewInCabinBtn');

  if (openBtn) {
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSceneryModal();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSceneryModal();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSceneryModal();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      applyCabinScenery(previewSceneryTheme, true);
      closeSceneryModal();
    });
  }

  if (previewCabinBtn) {
    previewCabinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (modal) {
        modal.classList.add('peeking');
        let toast = document.getElementById('sceneryPeekToast');
        if (!toast) {
          toast = document.createElement('div');
          toast.id = 'sceneryPeekToast';
          toast.className = 'scenery-peek-toast';
          toast.innerHTML = '👁️ Peeking at Live Cabin · Tap anywhere to return';
          document.body.appendChild(toast);
        }
        toast.classList.add('visible');

        const restore = (ev) => {
          if (ev) ev.stopPropagation();
          modal.classList.remove('peeking');
          if (toast) toast.classList.remove('visible');
          document.removeEventListener('click', restore, true);
        };
        setTimeout(() => {
          document.addEventListener('click', restore, true);
        }, 150);
      }
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeSceneryModal();
      }
    });
  }

  // Segmented tabs: Scenery vs Season
  const tabScenery = document.getElementById('sceneryTabPillScenery');
  const tabSeason = document.getElementById('sceneryTabPillSeason');
  const secScenery = document.getElementById('scenerySectionScenery');
  const secSeason = document.getElementById('scenerySectionSeason');

  const scrollBody = document.getElementById('sceneryScrollBody');

  let isManualTabScroll = false;
  if (tabScenery && secScenery) {
    tabScenery.addEventListener('click', () => {
      tabScenery.classList.add('active');
      if (tabSeason) tabSeason.classList.remove('active');
      isManualTabScroll = true;
      secScenery.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => { isManualTabScroll = false; }, 600);
    });
  }

  if (tabSeason && secSeason) {
    tabSeason.addEventListener('click', () => {
      tabSeason.classList.add('active');
      if (tabScenery) tabScenery.classList.remove('active');
      isManualTabScroll = true;
      secSeason.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => { isManualTabScroll = false; }, 600);
    });
  }

  if (scrollBody && secSeason) {
    scrollBody.addEventListener('scroll', () => {
      if (isManualTabScroll) return;
      const seasonTop = secSeason.offsetTop;
      if (scrollBody.scrollTop >= seasonTop - 90) {
        if (tabSeason) tabSeason.classList.add('active');
        if (tabScenery) tabScenery.classList.remove('active');
      } else {
        if (tabScenery) tabScenery.classList.add('active');
        if (tabSeason) tabSeason.classList.remove('active');
      }
    }, { passive: true });
  }
}

function openSceneryModal() {
  previewSceneryTheme = currentSceneryTheme;
  const heroImg = document.getElementById('sceneryHeroPreviewImg');
  if (heroImg && CABIN_SCENERIES[currentSceneryTheme]) {
    heroImg.src = CABIN_SCENERIES[currentSceneryTheme].wide || CABIN_SCENERIES[currentSceneryTheme].thumb;
  }

  const sCount = document.getElementById('sceneryCountBadge');
  if (sCount) sCount.textContent = Object.keys(CABIN_SCENERIES).length;

  const seaCount = document.getElementById('seasonCountBadge');
  if (seaCount) seaCount.textContent = SEASON_SCENERIES.length;

  const scrollBody = document.getElementById('sceneryScrollBody');
  if (scrollBody) scrollBody.scrollTop = 0;

  const tabScenery = document.getElementById('sceneryTabPillScenery');
  const tabSeason = document.getElementById('sceneryTabPillSeason');
  if (tabScenery) tabScenery.classList.add('active');
  if (tabSeason) tabSeason.classList.remove('active');

  renderSceneryGrid();
  renderSeasonSceneryRow();

  const modal = document.getElementById('sceneryModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('active');
  }
}

function closeSceneryModal() {
  // If user closed without clicking Apply, restore the committed current scenery
  if (previewSceneryTheme !== currentSceneryTheme) {
    applyCabinScenery(currentSceneryTheme, false);
  }
  const modal = document.getElementById('sceneryModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function renderSceneryGrid() {
  const grid = document.getElementById('sceneryGrid');
  if (!grid) return;

  grid.innerHTML = '';
  Object.values(CABIN_SCENERIES).forEach(scene => {
    const isSelected = (scene.id === previewSceneryTheme);
    const item = document.createElement('div');
    item.className = `scenery-option-item ${isSelected ? 'selected' : ''}`;
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    item.dataset.theme = scene.id;

    item.innerHTML = `
      <div class="scenery-thumb-wrap">
        <img class="scenery-thumb-img" src="${scene.thumb}" alt="${scene.name}" loading="lazy" />
        ${isSelected ? '<div class="scenery-check-badge">✓</div>' : ''}
        <div class="scenery-item-scrim">
          <span class="scenery-item-name">${scene.name}</span>
        </div>
      </div>
    `;

    item.addEventListener('click', () => {
      previewCabinScenery(scene.id);
    });

    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        previewCabinScenery(scene.id);
      }
    });

    grid.appendChild(item);
  });
}

function renderSeasonSceneryRow() {
  const row = document.getElementById('seasonSceneryRow');
  if (!row) return;

  row.innerHTML = '';
  SEASON_SCENERIES.forEach(s => {
    const isSelected = (s.themeId === previewSceneryTheme);
    const item = document.createElement('div');
    item.className = `season-scenery-item ${isSelected ? 'selected' : ''}`;
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    item.dataset.theme = s.themeId;

    item.innerHTML = `
      <div class="season-thumb-wrap">
        <img class="season-thumb-img" src="${s.portrait}" alt="${s.name}" loading="lazy" />
        ${isSelected ? '<div class="scenery-check-badge">✓</div>' : ''}
        <div class="season-item-scrim">
          <span class="season-item-name">${s.name}</span>
        </div>
      </div>
    `;

    item.addEventListener('click', () => {
      previewCabinScenery(s.themeId);
    });

    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        previewCabinScenery(s.themeId);
      }
    });

    row.appendChild(item);
  });
}

// Handle Incoming Avatar Messages from WebSocket Signaling
function handleAvatarMessage(message) {
  if (!isPartnerActive()) {
    return;
  }

  switch (message.type) {
    case 'avatar_move':
      moveAvatar('partnerAvatar', partnerAvatar, message.x, message.y, false);
      // Delay partner's autonomous wander so partner's real movement persists
      scheduleAvatarWander('partnerAvatar', 7000, 10000);
      break;

    case 'avatar_outfit':
      if (message.outfit) {
        partnerAvatar = { ...partnerAvatar, ...message.outfit };
        renderAvatarDOM('partnerAvatar', partnerAvatar, false);
        if (window.NookMonoV2 && typeof window.NookMonoV2.syncLoadout === 'function') {
          window.NookMonoV2.syncLoadout();
        }
        if (typeof updateLobbySeats === 'function') {
          updateLobbySeats();
        }
      }
      break;

    case 'avatar_hug':
      if (message.action === 'start') {
        triggerWarmHug(false);
      } else if (message.action === 'end') {
        endWarmHug(false);
      }
      break;

    case 'avatar_emote':
      triggerWarmHug(false);
      break;

    case 'scene_change':
    case 'avatar_scenery':
      if (message.themeId && CABIN_SCENERIES[message.themeId]) {
        applyCabinScenery(message.themeId, false);
      }
      break;
  }
}

// Auto-broadcast avatar outfit and cabin scenery when connected
function broadcastMyAvatar() {
  if (typeof sendSignaling === 'function') {
    sendSignaling({
      type: 'avatar_outfit',
      outfit: myAvatar
    });
    if (currentSceneryTheme && currentSceneryTheme !== 'classic') {
      sendSignaling({
        type: 'scene_change',
        themeId: currentSceneryTheme
      });
    }
  }
}

// Expose globally
window.initAvatarStage = initAvatarStage;
window.handleAvatarMessage = handleAvatarMessage;
window.setAvatarTalking = setAvatarTalking;
window.broadcastMyAvatar = broadcastMyAvatar;
window.applyCabinScenery = applyCabinScenery;
window.openSceneryModal = openSceneryModal;
window.triggerWarmHug = triggerWarmHug;
window.endWarmHug = endWarmHug;
window.triggerSoloWarmHug = triggerSoloWarmHug;
window.isPartnerActive = isPartnerActive;
window.updatePartnerPresence = updatePartnerPresence;
window.CABIN_SCENERIES = CABIN_SCENERIES;

// --- Vault / Wardrobe bridge -------------------------------------------------
// Note: `window.myAvatar` resolves to the #myAvatar DOM element, so use getters.
window.MAPLE_CHARACTERS = MAPLE_CHARACTERS;
window.getTerminalRole = getTerminalRole;
window.renderAvatarHTML = renderAvatarHTML;
window.getMyAvatar = () => myAvatar;
window.getPartnerAvatar = () => partnerAvatar;
window.setPartnerAvatar = (outfit) => {
  if (!outfit) return;
  const item = (typeof outfit === 'string') ? MAPLE_CHARACTERS[outfit] : outfit;
  if (!item) return;
  partnerAvatar = {
    ...partnerAvatar,
    characterId: item.id || item.characterId,
    sprite: item.sprite,
    walkSprite: item.walkSprite || null,
    slashSprite: item.slashSprite || null,
    name: item.name
  };
  renderAvatarDOM('partnerAvatar', partnerAvatar, false);
  if (typeof window.syncMonopolyCostumes === 'function') {
    window.syncMonopolyCostumes();
  }
};

/** Put on any character/costume by id. Returns false if unknown. */
window.equipAvatarCharacter = function (characterId, broadcast = true) {
  const item = MAPLE_CHARACTERS[characterId];
  if (!item) return false;
  if (myAvatar.characterId === characterId && !broadcast) return true;
  myAvatar = {
    ...myAvatar,
    characterId: item.id,
    sprite: item.sprite,
    walkSprite: item.walkSprite || null,
    slashSprite: item.slashSprite || null,
    name: item.name
  };
  saveAvatarConfig(myAvatar);
  renderAvatarDOM('myAvatar', myAvatar, true);
  if (broadcast && typeof sendSignaling === 'function') {
    sendSignaling({ type: 'avatar_outfit', outfit: myAvatar });
  }

  // Synchronize live loadouts to Monopoly v2 and v1
  if (typeof window.syncMonopolyCostumes === 'function') {
    window.syncMonopolyCostumes();
  } else if (window.NookMonoV2 && typeof window.NookMonoV2.syncLoadout === 'function') {
    window.NookMonoV2.syncLoadout();
  }
  if (typeof updateLobbySeats === 'function') {
    updateLobbySeats();
  }
  return true;
};

// Phase 5: Global Character Base Switcher Bridge
if (typeof window !== 'undefined') {
  window.addEventListener('sky:character_base_changed', (e) => {
    const base = e.detail && e.detail.characterBase;
    if (!base) return;
    const targetId = base === 'dxb' ? 'got_queen' : 'bkk_guy';
    window.equipAvatarCharacter(targetId, true);
  });

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      if (window.SkySupabase && typeof window.SkySupabase.getCharacterBase === 'function') {
        const base = window.SkySupabase.getCharacterBase();
        if (base === 'dxb' && myAvatar.characterId === 'bkk_guy') {
          window.equipAvatarCharacter('got_queen', false);
        } else if (base === 'bkk' && myAvatar.characterId === 'got_queen') {
          window.equipAvatarCharacter('bkk_guy', false);
        }
      }
    }, 100);
  });
}
