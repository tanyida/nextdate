/* Gift ideas from Singapore suppliers. Descriptions are our own words; links go to each brand's
 * official site. Next Date is not paid by these brands (any future paid placement must set sponsored: true).
 * Budget bands are indicative only. Editors should check each listing before launch. */
window.PL = window.PL || {};

PL.GIFT_TYPES = [
  { id: 'flowers', label: 'Flowers & plants', emoji: '💐' },
  { id: 'treats', label: 'Food & treats', emoji: '🍰' },
  { id: 'keepsakes', label: 'Keepsakes', emoji: '💍' },
  { id: 'fashion', label: 'Fashion & accessories', emoji: '👜' },
  { id: 'wellness', label: 'Home & wellness', emoji: '🕯️' },
  { id: 'experiences', label: 'Experiences', emoji: '🎟️' },
  { id: 'diy', label: 'DIY & heartfelt', emoji: '✍️' }
];
PL.GIFT_OCCASIONS = [
  { id: 'anniversary', label: 'Anniversary' }, { id: 'birthday', label: 'Birthday' }, { id: 'valentines', label: 'Valentine\'s' },
  { id: 'just-because', label: 'Just because' }, { id: 'sorry', label: 'Making up' }, { id: 'new', label: 'New couple' }
];
// The five "love languages": a popular, simple way to think about how someone feels appreciated.
PL.LOVE_LANGUAGES = [
  { id: 'gifts', label: 'Receiving gifts', hint: 'Lights up at a thoughtful present' },
  { id: 'time', label: 'Quality time', hint: 'Loves undivided attention and shared plans' },
  { id: 'words', label: 'Words of affirmation', hint: 'Treasures notes, compliments and "I\'m proud of you"' },
  { id: 'service', label: 'Acts of service', hint: 'Feels loved when you make life easier' },
  { id: 'touch', label: 'Physical touch', hint: 'Hugs, hand-holding, a massage' }
];
PL.GIFT_BANDS = { 1: 'Under $30', 2: '$30–$80', 3: '$80–$200', 4: '$200+' };

(function () {
  const G = (o) => Object.assign({ kind: 'shop', photo_kind: 'idea', sponsored: false, plan_activity: null, internal: null }, o);
  PL.GIFTS = [
    // ---- Flowers & plants ----
    G({ id: 'g-fareastflora', name: 'Fresh bouquet or potted orchid', supplier: 'Far East Flora', url: 'https://www.fareastflora.com/', type: 'flowers', band: 2,
      occasions: ['anniversary', 'birthday', 'valentines', 'sorry', 'just-because'], love: ['gifts'], photo: 'Orchid',
      desc: 'A long-running Singapore florist and nursery with bouquets, potted plants and hampers.',
      why: 'A potted orchid outlives a bouquet. Every new bloom is a small reminder of you.' }),
    G({ id: 'g-abetterflorist', name: 'Same-day surprise bouquet', supplier: 'A Better Florist', url: 'https://www.abetterflorist.com/', type: 'flowers', band: 2,
      occasions: ['birthday', 'valentines', 'sorry', 'just-because'], love: ['gifts', 'words'], photo: 'Rose',
      desc: 'Online florist delivering bouquets around Singapore, with a card message.',
      why: 'Send it to their office on an ordinary Tuesday. Unexpected beats expensive.' }),

    // ---- Food & treats ----
    G({ id: 'g-twg', name: 'Tea tin or tea gift set', supplier: 'TWG Tea', url: 'https://twgtea.com/', type: 'treats', band: 2,
      occasions: ['anniversary', 'birthday', 'just-because', 'new'], love: ['gifts'], photo: 'Tea',
      desc: 'Singapore luxury tea house known for its huge range of teas and elegant gift tins.',
      why: 'Pair it with a promise of a slow Sunday tea together. The ritual is the real gift.' }),
    G({ id: 'g-bacha', name: 'Coffee gift box', supplier: 'Bacha Coffee', url: 'https://bachacoffee.com/', type: 'treats', band: 3,
      occasions: ['anniversary', 'birthday', 'just-because'], love: ['gifts', 'service'], photo: 'Coffee_bean',
      desc: 'Singapore-born coffee house with single-origin Arabica coffees in giftable boxes.',
      why: 'Make their first cup the morning after. Small acts of care land deeply.' }),
    G({ id: 'g-bengawan', name: 'Kueh lapis & cookie box', supplier: 'Bengawan Solo', url: 'https://www.bengawansolo.com.sg/', type: 'treats', band: 1,
      occasions: ['birthday', 'just-because', 'new', 'sorry'], love: ['gifts', 'service'], photo: 'Kue_lapis',
      desc: 'A Singapore favourite for kueh, layered cakes and festive cookies since 1979.',
      why: 'Nostalgic local flavours spark stories about growing up. Ask which kueh was their childhood favourite.' }),
    G({ id: 'g-awfully', name: 'Chocolate cake for two', supplier: 'Awfully Chocolate', url: 'https://www.awfullychocolate.com/', type: 'treats', band: 2,
      occasions: ['birthday', 'anniversary', 'sorry', 'valentines'], love: ['gifts', 'time'], photo: 'Chocolate_cake',
      desc: 'Singapore chocolate bakery famous for its rich, simple chocolate cakes.',
      why: 'Sharing dessert slows a date down. Two forks, one cake, no phones.' }),
    G({ id: 'g-tbbakery', name: 'Breakfast-in-bed pastry run', supplier: 'Tiong Bahru Bakery', url: 'https://www.tiongbahrubakery.com/', type: 'treats', band: 1,
      occasions: ['just-because', 'birthday', 'sorry'], love: ['service', 'time'], photo: 'Croissant',
      desc: 'Popular Singapore bakery for croissants, kouign-amann and good coffee.',
      why: 'Getting up early to bring back their favourite pastry says "I thought of you first."' }),

    // ---- Keepsakes ----
    G({ id: 'g-risis', name: 'Gold-plated orchid jewellery', supplier: 'RISIS', url: 'https://www.risis.com/', type: 'keepsakes', band: 3,
      occasions: ['anniversary', 'valentines', 'birthday'], love: ['gifts'], photo: 'Vanda_Miss_Joaquim',
      desc: 'A Singapore icon known for real orchids preserved in gold, as brooches, pendants and earrings.',
      why: 'A keepsake tied to Singapore and to "us". Great for a milestone anniversary.' }),
    G({ id: 'g-carriek', name: 'Handcrafted jewellery piece', supplier: 'Carrie K.', url: 'https://carriek.com/', type: 'keepsakes', band: 3,
      occasions: ['anniversary', 'birthday', 'valentines'], love: ['gifts', 'words'], photo: 'Jewellery',
      desc: 'Singapore jewellery label making handcrafted, story-driven pieces.',
      why: 'Choose a piece that matches a shared memory and tell them why when you give it.' }),
    G({ id: 'g-bynd', name: 'Personalised leather journal', supplier: 'Bynd Artisan', url: 'https://byndartisan.com/', type: 'keepsakes', band: 2,
      occasions: ['anniversary', 'birthday', 'new'], love: ['words', 'gifts'], photo: 'Notebook',
      desc: 'Singapore stationery and leather brand that personalises notebooks, journals and bags.',
      why: 'Write the first page yourself, maybe the moment you knew. Then hand it over to fill.' }),

    // ---- Fashion & accessories ----
    G({ id: 'g-beyondthevines', name: 'Everyday bag or accessory', supplier: 'Beyond the Vines', url: 'https://www.beyondthevines.com/', type: 'fashion', band: 2,
      occasions: ['birthday', 'just-because'], love: ['gifts', 'service'], photo: 'Tote_bag',
      desc: 'Singapore design brand known for practical, colourful bags and apparel.',
      why: 'Practical gifts show you notice their routine. Pick the colour they always reach for.' }),
    G({ id: 'g-lovebonito', name: 'Dress or outfit for date night', supplier: 'Love, Bonito', url: 'https://www.lovebonito.com/', type: 'fashion', band: 2,
      occasions: ['birthday', 'valentines', 'just-because'], love: ['gifts'], photo: 'Dress',
      desc: 'Singapore-born womenswear label with everyday and occasion wear.',
      why: 'Gift it with the date it\'s for, so they have somewhere to wear it.' }),
    G({ id: 'g-tangs', name: 'Department store gift card', supplier: 'TANGS', url: 'https://www.tangs.com/', type: 'fashion', band: 3,
      occasions: ['birthday', 'just-because'], love: ['gifts', 'time'], photo: 'Orchard_Road',
      desc: 'Homegrown Singapore department store on Orchard Road.',
      why: 'Make it an experience: an afternoon shopping together, you carrying the bags.' }),

    // ---- Home & wellness ----
    G({ id: 'g-supermama', name: 'Singapore-design porcelain', supplier: 'Supermama', url: 'https://supermama.sg/', type: 'wellness', band: 2,
      occasions: ['anniversary', 'birthday', 'new'], love: ['gifts'], photo: 'Porcelain',
      desc: 'Singapore design store with porcelain and homeware featuring local motifs.',
      why: 'A piece for the home you share, or will. Quietly romantic.' }),
    G({ id: 'g-euyansang', name: 'Wellness gift set', supplier: 'Eu Yan Sang', url: 'https://www.euyansang.com/', type: 'wellness', band: 2,
      occasions: ['sorry', 'just-because', 'birthday'], love: ['service', 'gifts'], photo: 'Herbal_tea',
      desc: 'Long-established traditional wellness brand with herbal teas and gift sets.',
      why: 'For a partner who\'s run down: care you can hold. Add "rest, I\'ve got dinner".' }),

    // ---- Experiences (link to Next Date plans or official tickets) ----
    G({ id: 'g-pottery', kind: 'experience', name: 'Couples\' pottery class', supplier: 'Plan it on Next Date', type: 'experiences', band: 3,
      occasions: ['anniversary', 'birthday', 'valentines', 'new'], love: ['time', 'touch'], photo: 'Pottery', plan_activity: 'a-pottery',
      desc: 'A hands-on class where you each make a cup, glazed and ready weeks later.',
      why: 'Experiences create shared memories, and you get a keepsake at the end.' }),
    G({ id: 'g-spa', kind: 'experience', name: 'Couples\' massage', supplier: 'Plan it on Next Date', type: 'experiences', band: 4,
      occasions: ['anniversary', 'valentines', 'sorry', 'birthday'], love: ['touch', 'time'], photo: 'Massage', plan_activity: 'a-spa',
      desc: 'A side-by-side massage followed by tea, with nothing to plan but showing up.',
      why: 'Perfect for "physical touch" partners after a stressful stretch.' }),
    G({ id: 'g-cooking', kind: 'experience', name: 'Local cooking class for two', supplier: 'Plan it on Next Date', type: 'experiences', band: 3,
      occasions: ['anniversary', 'birthday', 'just-because'], love: ['time', 'service'], photo: 'Laksa', plan_activity: 'a-cookclass',
      desc: 'Cook a hawker classic together, then eat what you made.',
      why: 'Teamwork in the kitchen builds the same muscles you use in everyday life together.' }),
    G({ id: 'g-candle', kind: 'experience', name: 'Candle-making workshop', supplier: 'Plan it on Next Date', type: 'experiences', band: 2,
      occasions: ['new', 'just-because', 'birthday'], love: ['time'], photo: 'Candle', plan_activity: 'a-candle',
      desc: 'Blend a scent for each other\'s home in a 90-minute session.',
      why: 'Low pressure and creative, ideal for newer couples.' }),
    G({ id: 'g-mandai', kind: 'experience', name: 'Night Safari or zoo tickets', supplier: 'Mandai Wildlife Reserve', url: 'https://www.mandai.com/', type: 'experiences', band: 3,
      occasions: ['birthday', 'just-because', 'anniversary'], love: ['time'], photo: 'Night_Safari,_Singapore', plan_activity: 'a-nightsafari',
      desc: 'Tickets to Singapore\'s wildlife parks, by day or after dark.',
      why: 'A little adventure (and a little nervousness) brings couples closer.' }),
    G({ id: 'g-esplanade', kind: 'experience', name: 'Tickets to a show', supplier: 'Esplanade – Theatres on the Bay', url: 'https://www.esplanade.com/', type: 'experiences', band: 2,
      occasions: ['anniversary', 'birthday', 'valentines'], love: ['time'], photo: 'Esplanade_–_Theatres_on_the_Bay',
      desc: 'Concerts, theatre and dance at Singapore\'s performing arts centre.',
      why: 'Talk about the show over supper. It\'s an easy way to learn what moves them.' }),
    G({ id: 'g-gardens', kind: 'experience', name: 'Conservatory tickets', supplier: 'Gardens by the Bay', url: 'https://www.gardensbythebay.com.sg/', type: 'experiences', band: 2,
      occasions: ['new', 'just-because', 'valentines'], love: ['time'], photo: 'Gardens_by_the_Bay', plan_activity: 'a-cloudforest',
      desc: 'Flower Dome and Cloud Forest tickets: cool, beautiful and easy to talk in.',
      why: 'Air-conditioned and photogenic, a reliable first- or fifth-date gift.' }),

    // ---- DIY & heartfelt ----
    G({ id: 'g-openwhen', kind: 'diy', name: '"Open when…" letters', supplier: 'Make it yourself', type: 'diy', band: 1,
      occasions: ['anniversary', 'valentines', 'sorry', 'just-because'], love: ['words'], photo: 'Letter_(message)',
      desc: 'A bundle of envelopes: "open when you miss me", "…had a bad day", "…need a laugh".',
      why: 'Words of affirmation partners re-read these for years. Specific beats flowery.' }),
    G({ id: 'g-memorybook', kind: 'diy', name: 'Printed memory book of your dates', supplier: 'From your Next Date memories', type: 'diy', band: 1,
      occasions: ['anniversary', 'valentines', 'birthday'], love: ['words', 'time', 'gifts'], photo: 'Photo_album', internal: '#/memories',
      desc: 'Export your Memory book, print it, and add a handwritten note on the last page.',
      why: 'Looking back on good times together strengthens the bond. It\'s gratitude made visible.' }),
    G({ id: 'g-firstdate', kind: 'diy', name: 'Re-create your first date', supplier: 'Plan it on Next Date', type: 'diy', band: 2,
      occasions: ['anniversary', 'valentines'], love: ['time', 'words'], photo: 'Picnic', internal: '#/',
      desc: 'Same place, same order, plus one new surprise. Plan it, then send the invitation.',
      why: 'Revisiting a "first" lets you both notice how far you\'ve come.' }),
    G({ id: 'g-picnic', kind: 'diy', name: 'Botanic Gardens picnic basket', supplier: 'Make it yourself', type: 'diy', band: 1,
      occasions: ['just-because', 'new', 'sorry'], love: ['service', 'time'], photo: 'Gift_basket', plan_activity: 'a-botanic',
      desc: 'Pack their favourite snacks, a mat and a playlist, then plan the picnic as a date.',
      why: 'Effort over expense. They\'ll remember that you remembered their favourite snack.' })
  ];
})();
