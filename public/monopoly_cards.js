/**
 * Nook Airline — Sky Monopoly Couple Vibe Cards Deck (Shared: Server & Client)
 * 100 curated couple discovery questions:
 *   - 30 'wmlt' (Who's More Likely To) [IDs 1..30]
 *   - 70 'mind' (Read My Mind) [IDs 101..170]
 *
 * Guarantees zero question repeats until all 100 have been drawn.
 */
(function (root) {
  const CARD_DECK = [
    // =========================================================
    // 🎯 WHO'S MORE LIKELY TO (30 CARDS: Teasing, Chemistry & Boldness)
    // =========================================================
    { id: 1, type: 'wmlt', q: 'initiate a kiss in a quiet elevator when the doors close?' },
    { id: 2, type: 'wmlt', q: 'pull the other into the shower the second we enter the hotel room?' },
    { id: 3, type: 'wmlt', q: 'whisper something dangerously dirty in public with a straight face?' },
    { id: 4, type: 'wmlt', q: 'secretly be the more dominant one once the bedroom door is locked?' },
    { id: 5, type: 'wmlt', q: 'wake the other person up at 2 AM craving physical closeness?' },
    { id: 6, type: 'wmlt', q: 'send a risky, breathless voice note right before the other has a meeting?' },
    { id: 7, type: 'wmlt', q: 'get turned on purely from prolonged, silent eye contact across dinner?' },
    { id: 8, type: 'wmlt', q: 'steal the other\'s oversized shirt and wear nothing else around the room?' },
    { id: 9, type: 'wmlt', q: 'bite the other\'s lip when kissing gets too intense?' },
    { id: 10, type: 'wmlt', q: 'crave a full hour of slow, sensory neck and back massage with warm oil?' },
    { id: 11, type: 'wmlt', q: 'suggest a weekend getaway to a private pool villa with zero clothes allowed?' },
    { id: 12, type: 'wmlt', q: 'leave visible marks on the other\'s neck and secretly smile about it?' },
    { id: 13, type: 'wmlt', q: 'be the one to pin the other against the door before unpacking any luggage?' },
    { id: 14, type: 'wmlt', q: 'get completely weak in the knees from low, husky whispers in their ear?' },
    { id: 15, type: 'wmlt', q: 'get caught daydreaming about our last night together while sitting at work?' },
    { id: 16, type: 'wmlt', q: 'suggest staying in bed ordering room service for 24 hours straight?' },
    { id: 17, type: 'wmlt', q: 'get playfully possessive when someone else looks for a second too long?' },
    { id: 18, type: 'wmlt', q: 'initiate intimacy on a high-floor balcony overlooking Bangkok at midnight?' },
    { id: 19, type: 'wmlt', q: 'be a confident boss in public, but a soft, clingy baby in private?' },
    { id: 20, type: 'wmlt', q: 'tease the other person all day over text, then act completely innocent on the call?' },
    { id: 21, type: 'wmlt', q: 'look across a crowded room and mouth "wait until tonight"?' },
    { id: 22, type: 'wmlt', q: 'fall asleep with their face buried in the other person\'s chest?' },
    { id: 23, type: 'wmlt', q: 'pull the other back into bed by their waist when they try to get up?' },
    { id: 24, type: 'wmlt', q: 'be more vocal and expressive about what feels good in the moment?' },
    { id: 25, type: 'wmlt', q: 'give the first lingering kiss the second she clears Suvarnabhumi customs?' },
    { id: 26, type: 'wmlt', q: 'suggest testing out a sensual blindfold or silk ribbon game?' },
    { id: 27, type: 'wmlt', q: 'lose all composure and get goosebumps when their neck is kissed?' },
    { id: 28, type: 'wmlt', q: 'slip a secret love note into the other\'s luggage for the flight back?' },
    { id: 29, type: 'wmlt', q: 'secretly count down the exact days and hours until the next Bangkok landing?' },
    { id: 30, type: 'wmlt', q: 'look at the other person right now on this call and want to kiss them immediately?' },

    // =========================================================
    // 🔮 READ MY MIND (70 CARDS: Intimacy, Fantasies, Desires & Quirks)
    // =========================================================
    { id: 101, type: 'mind', q: 'My preferred physical touch when we are alone in the room:', a: 'Slow, light fingernails tracing my back and ribs 🪶', b: 'A firm, possessive hand gripping my waist/hip tight 🔥' },
    { id: 102, type: 'mind', q: 'What breaks my composure faster during intimacy?', a: 'Hearing low, breathless dirty-talk whispers in my ear 🎙️', b: 'Intense, unbroken eye contact with a slow smirk 👀' },
    { id: 103, type: 'mind', q: 'When we meet at Bangkok airport, our first physical touch should be:', a: 'A tight embrace where you lift me off the ground 🫂', b: 'A deep, lingering kiss right there in public 💋' },
    { id: 104, type: 'mind', q: 'My secret bedroom dynamic preference:', a: 'Being taken complete control of and pinned down helplessly ⛓️', b: 'Straddling on top, teasing, and setting the pace myself 👑' },
    { id: 105, type: 'mind', q: 'Our first morning waking up together in Bangkok:', a: 'Slow hands sliding under sheets at 7 AM, half-asleep skin-to-skin 🌅', b: 'Sleeping late in bathrobes, feeding each other breakfast in bed 🥐' },
    { id: 106, type: 'mind', q: 'What kind of kissing makes my heart beat faster?', a: 'Soft, agonizingly slow lips that barely graze mine without touching 🪶', b: 'Deep, breathless passion with hands tangled in my hair 🔥' },
    { id: 107, type: 'mind', q: 'Sensory surrender game I am secretly more curious about:', a: 'Blindfold with ice and warm kisses traced across my skin 🧊', b: 'Soft silk ribbons holding my wrists while you tease me 🎀' },
    { id: 108, type: 'mind', q: 'Across the miles (BKK ↔ DXB), what teases my mind more?', a: 'A steamy 60-second voice note describing what you would do to me 🎙️', b: 'A discreet, alluring photo sent in the middle of the day 📸' },
    { id: 109, type: 'mind', q: 'Our ideal private hotel sanctuary weekend:', a: 'High-floor Bangkok penthouse suite, curtains open at midnight 🏙️', b: 'Secluded Samui pool villa with zero neighbors and no clothes 🏝️' },
    { id: 110, type: 'mind', q: 'In the bedroom, my preferred pacing is:', a: 'Hours of teasing, building tension, and slow warm-up ⏳', b: 'Spontaneous, feverish intensity right against the door 🚪' },
    { id: 111, type: 'mind', q: 'What kind of praise turns me on more?', a: 'Hearing how soft, beautiful, and addictive my body feels to you ✨', b: 'Hearing you say I am completely yours and nobody else compares 🖤' },
    { id: 112, type: 'mind', q: 'My biggest physical sensitivity zone:', a: 'My neck, collarbone, and the soft spot behind my ear 💋', b: 'My lower back, hips, and inner thighs 🤲' },
    { id: 113, type: 'mind', q: 'When your hand touches me under the table at dinner:', a: 'A slow hand sliding up my inner thigh stopping just short 🤫', b: 'Interlocking our fingers tightly with thumbs rubbing firmly 🤝' },
    { id: 114, type: 'mind', q: 'The naughtiest spontaneous thrill I would say yes to:', a: 'Sneaking a breathless make-out session in a dark luxury cinema 🎬', b: 'Whispering the dirtiest bedroom thought into your ear at dinner 🍷' },
    { id: 115, type: 'mind', q: 'After we finish making love, my natural craving is:', a: 'Tangled together chest-to-chest, breathing slowing down in silence 🤍', b: 'Laughing together in bed, sharing cold drinks and late-night snacks 🍇' },
    { id: 116, type: 'mind', q: 'When I am comfortable behind closed doors, my real personality is:', a: 'A sassy brat who loves to tease, provoke, and play hard to get 😈', b: 'A soft, cuddly baby who melts the second you hold me 🥺' },
    { id: 117, type: 'mind', q: 'The visual that turns me on most:', a: 'Seeing you dressed up in sharp, sophisticated luxury clothes 👔', b: 'Seeing you in raw comfort, messy hair, wearing just a robe or boxers 🛏️' },
    { id: 118, type: 'mind', q: 'Temperature and touch contrast I crave more:', a: 'Warm scented jasmine massage oil smoothed over my shoulders and hips 🪔', b: 'Cool silk sheets, goosebumps, and heated skin-on-skin friction ❄️' },
    { id: 119, type: 'mind', q: 'My secret turn-on regarding bedroom audio:', a: 'Quiet, breathless whimpers and heavy breathing in the dark 🤫', b: 'Bold, uninhibited dirty talk telling me exactly what feels good 🗣️' },
    { id: 120, type: 'mind', q: 'If we have 30 minutes in a luxury hotel suite before dinner:', a: 'A steamy shower together pressing against the glass 🚿', b: 'A quick, passionate round against the headboard, messing up our hair 💥' },
    { id: 121, type: 'mind', q: 'When I miss you late at night in bed:', a: 'I replay our conversations and voice notes until I drift off 🎧', b: 'I imagine your hands on my body and get restless under the sheets 💭' },
    { id: 122, type: 'mind', q: 'In bed, do I prefer being provoked or comforted?', a: 'Provoked: teasing me until I lose my patience and beg 😈', b: 'Comforted: worshipped with slow, gentle kisses from head to toe 🕊️' },
    { id: 123, type: 'mind', q: 'What turns my brain on faster before physical touch?', a: 'Sharp banter, witty flirting, and electric eye contact 🧠', b: 'Confidence, dominant energy, and taking charge of decisions 👑' },
    { id: 124, type: 'mind', q: 'A surprise sensual gift for our next Bangkok trip:', a: 'Delicate black lace lingerie picked out by you for me to wear 🖤', b: 'A luxury bottle of body oil and a silk blindfold for us to explore 🕯️' },
    { id: 125, type: 'mind', q: 'My favorite spot to receive unexpected kisses in public:', a: 'The side of my neck while you stand behind me in line 💋', b: 'The back of my hand while you look directly into my eyes 🌹' },
    { id: 126, type: 'mind', q: 'When intimacy gets intense, my hands naturally want to:', a: 'Grip your hair tightly and pull your face closer 💆', b: 'Dig my fingernails into your shoulders and back ⚡' },
    { id: 127, type: 'mind', q: 'What kind of power dynamic turns me on more?', a: 'You taking the lead completely, making every move without asking ⛓️', b: 'A playful battle of power where we both fight for control ⚔️' },
    { id: 128, type: 'mind', q: 'The best way to wake me up when sharing a bed:', a: 'Gentle morning kisses along my jawline until my eyes open 🌤️', b: 'Warm hands sliding under my clothes before either of us speaks 🔥' },
    { id: 129, type: 'mind', q: 'Walking together through a Bangkok night market:', a: 'Holding hands with our fingers locked tightly the entire time 🤝', b: 'Your arm wrapped around my waist, pulling me close through the crowd 🫂' },
    { id: 130, type: 'mind', q: 'The most intoxicating scent to me:', a: 'Fresh skin, clean hotel linen, and faint warm vanilla perfume 🧴', b: 'Scented jasmine massage oil mixed with the heat of our bodies 🌸' },
    { id: 131, type: 'mind', q: 'In bed, what makes me feel most desired?', a: 'The way you look at my body like you cannot get enough of it 👀', b: 'The way your breath catches and your hands tremble when touching me 💓' },
    { id: 132, type: 'mind', q: 'A secret fantasy for our Bangkok arrival night:', a: 'Checking in under fake names and roleplaying as strangers meeting 🎭', b: 'Renting a private rooftop pool and swimming naked under the stars 🏊' },
    { id: 133, type: 'mind', q: 'What kind of teasing drives me crazier?', a: 'Physical: Kissing everywhere on my body EXCEPT where I want it most 😫', b: 'Mental: Texting me building up tension all day before we meet 📱' },
    { id: 134, type: 'mind', q: 'My reaction to a little protective jealousy:', a: 'I secretly find a little possessiveness hot and flattering 😏', b: 'I prefer pure, calm trust with zero jealousy 🕊️' },
    { id: 135, type: 'mind', q: 'When we kiss, my favorite rhythm is:', a: 'Slow, lingering, tasting every second with deep pauses 🍯', b: 'Urgent, breathless, passionate, and slightly hungry 🌊' },
    { id: 136, type: 'mind', q: 'What would I rather wear to bed when we are together?', a: 'Silky lingerie that looks gorgeous and begs to be taken off 👙', b: 'Just an oversized t-shirt belonging to you, with bare legs 👕' },
    { id: 137, type: 'mind', q: 'When resolving tension or a small argument during the day:', a: 'Talking it through calmly over wine, then reconnecting intimately 🍷', b: 'Passionate make-up intimacy that clears all the air instantly ⚡' },
    { id: 138, type: 'mind', q: 'What kind of touch makes me completely melt and relax?', a: 'Firm, kneading shoulder and scalp massage with your fingers 💆', b: 'Gentle fingertips tracing lazy circles on my stomach and hips 🌀' },
    { id: 139, type: 'mind', q: 'When looking at each other across the dinner table:', a: 'A slow, devouring gaze that undresses me with your eyes 😈', b: 'A warm, loving smile that makes me feel like the only person in the room ✨' },
    { id: 140, type: 'mind', q: 'The bedroom rule I would be most excited to try:', a: 'The No-Speaking Rule: only communicating through breath and touch 🤫', b: 'The Pleasure-First Rule: one person must wait until the other is satisfied ⏳' },
    { id: 141, type: 'mind', q: 'What kind of voice note from Dubai turns me on more?', a: 'A raspy, quiet whisper recorded in bed right before falling asleep 🌙', b: 'A confident, teasing voice note telling me what you will do to me in Bangkok ✈️' },
    { id: 142, type: 'mind', q: 'My favorite place to be touched while standing up:', a: 'Hands gripping both sides of my waist, pulling me flush against your hips 💥', b: 'A hand gently on the back of my neck, tilting my head back for a kiss 💋' },
    { id: 143, type: 'mind', q: 'Our ideal tropical rainstorm afternoon in Bangkok:', a: 'Heavy rain outside while staying under thick blankets kissing 🌧️', b: 'Watching the storm from a high-rise balcony in bathrobes with wine 🥂' },
    { id: 144, type: 'mind', q: 'How do I like foreplay to begin?', a: 'Hours before, through suggestive glances, whispers, and text banter 💭', b: 'Spontaneous, catching me completely off guard when I least expect it ⚡' },
    { id: 145, type: 'mind', q: 'What turns me on more during foreplay?', a: 'Being kissed slowly down my stomach until my hips arch 🌊', b: 'Gentle, teasing biting on the curve where my neck meets my shoulder 🐾' },
    { id: 146, type: 'mind', q: 'The ultimate private luxury evening fantasy:', a: 'A hot tub on a private terrace surrounded by candles and champagne 🍾', b: 'A full sensory evening with body oil, ambient music, and no rush 🕯️' },
    { id: 147, type: 'mind', q: 'What kind of eye contact during intimacy hits harder?', a: 'Holding eye contact during the most intense climax moment 👁️', b: 'Closing our eyes, losing ourselves purely in the physical sensation 🌌' },
    { id: 148, type: 'mind', q: 'When we are apart across the miles (BKK ↔ DXB), what makes me feel closest?', a: 'Falling asleep on voice call listening to each other breathe 😴', b: 'Sharing spontaneous unedited photos of our day showing our real life 📸' },
    { id: 149, type: 'mind', q: 'In bed, do I like variety or finding that one rhythm?', a: 'Spontaneous variety: trying new angles and rhythms out of nowhere 🔄', b: 'Deep rhythm: finding the exact spot and staying there until we break 🌊' },
    { id: 150, type: 'mind', q: 'My biggest vulnerability when falling for someone:', a: 'Falling deeply and being terrified of the magic fading 🥺', b: 'Opening up my deepest, craziest thoughts and hoping I am accepted 🤍' },
    { id: 151, type: 'mind', q: 'A spontaneous thrill I would secretly love:', a: 'Driving to a scenic viewpoint late at night and making out in the car 🚗', b: 'Kissing passionately in the back of a luxury cab driving through city lights 🚕' },
    { id: 152, type: 'mind', q: 'When my partner undresses me:', a: 'Slowly, piece by piece, kissing each new inch of exposed skin ⏳', b: 'Eagerly, urgently, like you have waited all week to touch me 🔥' },
    { id: 153, type: 'mind', q: 'What turns me on more: words or physical reactions?', a: 'Hearing you whisper how good it feels and how much you crave me 💬', b: 'Feeling your body tremble, your heartbeat race, and your hands grip me 💓' },
    { id: 154, type: 'mind', q: 'The morning after an unforgettable night together:', a: 'Staying in bed laughing about how wild last night was, refusing to get up ☕', b: 'Immediately starting round two while still half-asleep 🛌' },
    { id: 155, type: 'mind', q: 'What makes a partner irresistibly attractive to me?', a: 'Someone who carries themselves with quiet strength and commands respect 👑', b: 'Someone who is playful, witty, and can make me laugh until my stomach hurts 😂' },
    { id: 156, type: 'mind', q: 'My favorite random kiss to receive:', a: 'A gentle forehead kiss that feels protective, warm, and tender 🕊️', b: 'A sudden, deep kiss on the lips that cuts off whatever sentence I was saying 💥' },
    { id: 157, type: 'mind', q: 'In intimacy, do I prefer being the hunter or the prize?', a: 'The prize: make me feel relentlessly pursued and craved 💎', b: 'The hunter: let me tease you and bring you to your knees 🏹' },
    { id: 158, type: 'mind', q: 'What bedroom lighting sets the ultimate mood?', a: 'Almost total darkness with just faint city lights glowing through sheer blinds 🌃', b: 'Warm golden candlelight casting shadows across our skin 🕯️' },
    { id: 159, type: 'mind', q: 'When I touch your chest and stomach, I want you to:', a: 'Let out a low sigh, close your eyes, and lean into my touch 😌', b: 'Grab my wrist, pull me on top of you, and take control 🔥' },
    { id: 160, type: 'mind', q: 'The fantasy outfit I would love in our private room:', a: 'Pure elegance: a silk robe that slips effortlessly to the floor 👘', b: 'Delicate and bold: strappy matching black lace lingerie 🖤' },
    { id: 161, type: 'mind', q: 'What gives me more butterfly chills?', a: 'A slow breath blown across my collarbone before a kiss 🪶', b: 'A firm, possessive hand in my hair tilting my head to the side ⚡' },
    { id: 162, type: 'mind', q: 'Our ideal travel ritual when she arrives in Bangkok:', a: 'Unpacking together, playing music, opening wine, and catching up on everything 🍷', b: 'Dumping the bags on the floor, locking the door, and handling our cravings first 💥' },
    { id: 163, type: 'mind', q: 'What teasing text from Dubai would keep me distracted all day?', a: '"I bought something new for our Bangkok nights... you will have to take it off me." 👙', b: '"I couldn\'t sleep last night because all I could think about was your hands on me." 💭' },
    { id: 164, type: 'mind', q: 'When kissing against a wall, what position is hotter?', a: 'My back against the wall, with your hands on either side trapping me 🧱', b: 'Your back against the wall, with me pulling you in by your collar 👔' },
    { id: 165, type: 'mind', q: 'My secret preference for touch pacing:', a: 'Starting agonizingly slow for 30 minutes, building until we can\'t take it ⏳', b: 'Immediate high heat that explodes into passionate intensity 🔥' },
    { id: 166, type: 'mind', q: 'What kind of reassurance turns me on emotionally?', a: 'Knowing that you only have eyes for me, no matter who is around 👁️', b: 'Knowing that you admire my drive, ambition, and mind as much as my body 🧠' },
    { id: 167, type: 'mind', q: 'If we take a private sunset boat ride on the Chao Phraya river:', a: 'Sitting at the back wrapped in a blanket, whispering and drinking champagne 🥂', b: 'Standing at the bow feeling the wind, taking photos, and stealing kisses ⛵' },
    { id: 168, type: 'mind', q: 'What is my biggest physical turn-on during foreplay?', a: 'Warm lips tracing slowly down my neck, pausing at my pulse point 💋', b: 'Fingertips lightly tracing the inside of my wrists, arms, and ribs 🪶' },
    { id: 169, type: 'mind', q: 'Our last morning in Bangkok before your flight:', a: 'One last slow, emotional, lingering round of lovemaking to remember until next month 🌅', b: 'Holding each other silently in bed, soaking up every minute before the airport 🫂' },
    { id: 170, type: 'mind', q: 'Honestly, what am I thinking about when I look at you right now on this call?', a: 'How lucky I feel to have found such rare, electric chemistry with you ✨', b: 'How much I wish we were in the exact same room right this second 🛏️' }
  ];

  const CARD_BY_ID = Object.fromEntries(CARD_DECK.map((c) => [c.id, c]));
  const VALID_CARD_IDS = CARD_DECK.map((c) => c.id);
  const VALID_ID_SET = new Set(VALID_CARD_IDS);

  function isValidCardId(id) {
    return id != null && VALID_ID_SET.has(Number(id));
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Builds an unplayed shuffled deck.
   * If all 100 cards have been played, resets history and returns full 100 cards.
   */
  function createShuffledDeck(playedIds = []) {
    const playedSet = new Set((playedIds || []).map(Number).filter(isValidCardId));
    let unplayed = VALID_CARD_IDS.filter((id) => !playedSet.has(id));
    let didReset = false;
    if (unplayed.length === 0) {
      unplayed = [...VALID_CARD_IDS];
      didReset = true;
    }
    return {
      deck: shuffle(unplayed),
      didReset
    };
  }

  /**
   * Safely returns a card by ID. If invalid or missing, picks a valid unplayed card.
   * NEVER blindly falls back to Card #1!
   */
  function getSafeCard(cardId, playedIds = []) {
    const numId = Number(cardId);
    if (isValidCardId(numId) && CARD_BY_ID[numId]) {
      return CARD_BY_ID[numId];
    }
    const playedSet = new Set((playedIds || []).map(Number).filter(isValidCardId));
    const unplayed = VALID_CARD_IDS.filter((id) => !playedSet.has(id));
    const fallbackId = unplayed.length > 0
      ? unplayed[Math.floor(Math.random() * unplayed.length)]
      : VALID_CARD_IDS[Math.floor(Math.random() * VALID_CARD_IDS.length)];
    return CARD_BY_ID[fallbackId];
  }

  const exportObj = {
    CARD_DECK,
    CARD_BY_ID,
    VALID_CARD_IDS,
    isValidCardId,
    shuffle,
    createShuffledDeck,
    getSafeCard
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportObj;
  }
  if (typeof window !== 'undefined') {
    window.MonopolyCards = exportObj;
    window.CARD_DECK = CARD_DECK;
    window.CARD_BY_ID = CARD_BY_ID;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
