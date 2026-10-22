/* Activities listed on GetYourGuide (https://www.getyourguide.com/singapore-l170/), checked 22 Oct 2026.
 * Facts only (name, from-price, rating, link, the listing's photo) plus our own short description.
 * Prices on GetYourGuide are in USD "from" prices; converted at ~1.30 SGD/USD and rounded — always check the
 * live listing. Locations are the main venue named in the listing. Get GetYourGuide's permission (or join
 * their partner programme) before a public launch. */
window.PL = window.PL || {};

(function () {
  const GYG = 'https://www.getyourguide.com/singapore-l170/';
  const img = (h) => 'https://cdn.getyourguide.com/img/tour/' + h;
  const usd = (n) => Math.round(n * 1.3);
  const G = (o) => Object.assign({
    type: 'evergreen', start_date: null, end_date: null, days: null, price_max: null,
    kid_friendly: true, kid_age_min: 0, booking_required: true, pet_friendly: false, indoor_outdoor: 'outdoor',
    source_name: 'GetYourGuide', source_url: GYG, sponsored: false, status: 'live', pinned: false,
    last_verified_at: '2026-10-22', photo: '', photo_kind: '', image_credit: 'GetYourGuide', region: 'Central'
  }, o, {
    official_url: GYG + o.slug, booking_url: GYG + o.slug, image_page: GYG + o.slug,
    price_min: usd(o.usd), price_note: 'From US$' + o.usd.toFixed(2) + ' on GetYourGuide (≈S$' + usd(o.usd) + ')' + (o.rating ? ' · ★ ' + o.rating : '')
  });

  PL.GYG_ACTIVITIES = [
    G({ id: 'gyg-gardens-skyway', name: 'Gardens by the Bay: OCBC Skyway, Flower Dome & Cloud Forest', slug: 'gardens-by-the-bay-ocbc-skyway-flower-dome-and-cloud-forest-t1467941/', usd: 62.5, rating: '4.4 (31)',
      short_description: 'One ticket for the treetop Skyway walk and both cooled conservatories, an easy half-day of "wow" moments.',
      categories: ['nature', 'chill'], vibes: ['romantic', 'first-date', 'chill'], time_slots: ['morning', 'afternoon', 'evening'], duration_min: 180,
      venue: 'Gardens by the Bay', address: '18 Marina Gardens Dr', postal_code: '018953', lat: 1.2818, lng: 103.8637, indoor_outdoor: 'indoor',
      image_url: img('07da2b78a014bb4565c9a39cd294b3cf8b7773fe815b562d1b301e7287a61864.jpg/68.jpg') }),
    G({ id: 'gyg-cruise-rhapsody', name: 'River cruise + Garden Rhapsody & Spectra light shows', slug: 'singapore-river-cruise-night-garden-rhapsody-spectra-show-t1072669/', usd: 23.44, rating: '4.8 (1,865)',
      short_description: 'An evening bumboat ride along the river, timed to catch both Marina Bay light shows. Great value and very romantic.',
      categories: ['tours', 'chill'], vibes: ['romantic', 'first-date'], time_slots: ['evening'], duration_min: 150,
      venue: 'Singapore River & Marina Bay', address: 'Clarke Quay to Marina Bay', postal_code: '179024', lat: 1.2892, lng: 103.8530,
      image_url: img('90aec4f22f92e4a4bd30172080fb3a1c2016afd1d6cf30be4edea16987fcab60.png/68.jpg') }),
    G({ id: 'gyg-starry-cruise', name: 'Starry Night Cruise with satay, Spectra & Rhapsody', slug: 'singapore-starry-night-cruise-rhapsody-spectra-satay-t712172/', usd: 76.66, rating: '4.5 (1,747)',
      short_description: 'A night cruise past the skyline with satay on board and both light shows. Dinner and a show in one.',
      categories: ['tours', 'food'], vibes: ['romantic'], time_slots: ['evening'], duration_min: 180,
      venue: 'Marina Bay', address: 'Marina Bay', postal_code: '018956', lat: 1.2847, lng: 103.8575,
      image_url: img('a83b81c984f5f252875a63da1e2b08f35dac6c5749ec35463f79ba320efd6b47.png/68.jpg') }),
    G({ id: 'gyg-sunset-cruise', name: 'Skyline sunset cruise with guided night walk', slug: 'singapore-skyline-sunset-cruise-with-guided-night-walk-t1379332/', usd: 43.05, rating: '4.6 (21)',
      short_description: 'Watch the skyline turn gold from the water, then stroll the bay with a guide as the lights come on.',
      categories: ['tours', 'nature'], vibes: ['romantic', 'chill'], time_slots: ['evening'], duration_min: 150,
      venue: 'Marina Bay', address: 'Marina Bay', postal_code: '018956', lat: 1.2838, lng: 103.8590,
      image_url: img('f4065650a88dcf10bb06849cda6b6b90fd9ec69bb72d87033af719cf7fcb67da.png/68.jpg') }),
    G({ id: 'gyg-gardens-night', name: 'Gardens by the Bay night tour: domes & Garden Rhapsody', slug: 'gardens-by-the-bay-night-tour-with-domes-garden-rhapsody-t1460225/', usd: 74.36, rating: '4.8 (5)',
      short_description: 'A guided evening through the domes, ending under the Supertrees for the light-and-music show.',
      categories: ['nature', 'tours'], vibes: ['romantic', 'cultural'], time_slots: ['evening'], duration_min: 180,
      venue: 'Gardens by the Bay', address: '18 Marina Gardens Dr', postal_code: '018953', lat: 1.2815, lng: 103.8640,
      image_url: img('1e12d6caff071303bab095fbd4c537bf0a7ec7e8bb74122cc6cf6cf66918dd4d.png/68.jpg') }),
    G({ id: 'gyg-skypark', name: 'Marina Bay Sands SkyPark Observation Deck', slug: 'marina-bay-sands-skypark-observation-deck-ticket-t131787/', usd: 27.35, rating: '4.5 (8,180)',
      short_description: 'The classic 56th-floor view over the bay. Go at sunset and stay for the city lights.',
      categories: ['chill', 'tours'], vibes: ['romantic', 'first-date'], time_slots: ['morning', 'afternoon', 'evening'], duration_min: 90,
      venue: 'Marina Bay Sands SkyPark', address: '10 Bayfront Ave', postal_code: '018956', lat: 1.2834, lng: 103.8607,
      image_url: img('3f6607abd8b7d8803e5a40c7189a7c3b4122cc27825cefcbd89d74e856a8e26a.png/68.jpg') }),
    G({ id: 'gyg-food-stories', name: 'Singapore Stories food tour (12+ tastings)', slug: 'singapore-stories-food-tour-with-12-tastings-t1107601/', usd: 98.45, rating: '4.9 (454)',
      short_description: 'A guided eat-your-way walk with a dozen local tastings and the stories behind each dish. Come hungry.',
      categories: ['food', 'tours'], vibes: ['cultural', 'adventurous', 'first-date'], time_slots: ['afternoon', 'evening'], duration_min: 210,
      venue: 'Chinatown', address: 'Chinatown', postal_code: '058357', lat: 1.2830, lng: 103.8443,
      image_url: img('5d2b8ae10a7e3251ae5547b3cdbc3db54761f4898a42747d6c73659b0aa0c90c.jpeg/68.jpg') }),
    G({ id: 'gyg-chinatown-lunch', name: 'Chinatown historic walking tour with lunch', slug: 'singapore-chinatown-historic-walking-tour-with-lunch-t517630/', usd: 53.91, rating: '5.0 (154)',
      short_description: 'Temples, shophouses and old trades with a local guide, finishing with lunch together.',
      categories: ['tours', 'food', 'arts'], vibes: ['cultural', 'first-date'], time_slots: ['morning'], duration_min: 180,
      venue: 'Chinatown', address: 'Chinatown', postal_code: '058357', lat: 1.2836, lng: 103.8443,
      image_url: img('f46f7e59de5f8bb8.jpeg/68.jpg') }),
    G({ id: 'gyg-ethnic-quarters', name: 'Chinatown, Little India & Arab Street walking tour', slug: '4hour-chinatown-little-india-arab-street-walking-tour-t997547/', usd: 61.91, rating: '4.9 (452)',
      short_description: 'Three heritage districts in one guided walk: colour, food stalls and stories at every turn.',
      categories: ['tours', 'arts'], vibes: ['cultural', 'adventurous'], time_slots: ['morning', 'afternoon'], duration_min: 240,
      venue: 'Chinatown → Little India → Kampong Glam', address: 'Chinatown, Little India & Kampong Glam', postal_code: '209209', lat: 1.2985, lng: 103.8540,
      image_url: img('fb54b46b2c6e7750d0612ac29ce64b4b5a8f191fede9547c56b988b864f51ba7.png/68.jpg') }),
    G({ id: 'gyg-little-india', name: 'Little India & Kampong Glam hidden trails walk', slug: 'singapore-little-india-and-kampong-glam-hidden-trails-t1190131/', usd: 68.88, rating: '4.4 (9)',
      short_description: 'Back lanes, spice shops and murals of two neighbourhoods, with a guide who knows the shortcuts.',
      categories: ['tours', 'arts'], vibes: ['cultural', 'first-date'], time_slots: ['morning', 'afternoon'], duration_min: 180,
      venue: 'Little India & Kampong Glam', address: 'Little India', postal_code: '209209', lat: 1.3045, lng: 103.8540,
      image_url: img('31edc2aac9e104fc66bbd4eb5cdfa82ca6d3ff7be54a4c7c6decff9894cffc27.jpg/68.jpg') }),
    G({ id: 'gyg-bike-tour', name: 'Lion City highlights bike tour', slug: 'singapore-lion-city-highlights-half-day-bike-tour-t327376/', usd: 66.43, rating: '4.9 (2,422)',
      short_description: 'Cycle the bay, the civic district and the river with a small group. Active, scenic and easy-going.',
      categories: ['sports', 'tours'], vibes: ['adventurous', 'first-date'], time_slots: ['morning', 'evening'], duration_min: 240,
      venue: 'Marina Bay & Civic District', address: 'Marina Bay', postal_code: '018956', lat: 1.2880, lng: 103.8535, kid_age_min: 10,
      image_url: img('cbf34455107882875e6d66fa4adc37bf815a2ee182169364c961becc01d144c3.jpg/68.jpg') }),
    G({ id: 'gyg-photoshoot', name: 'Couples\' private photoshoot at iconic spots', slug: 'singapore-iconic-private-photoshoot-t1198509/', usd: 113.08, rating: '4.9 (16)',
      short_description: 'A pro photographer guides you around Marina Bay landmarks. Leave with photos of the two of you that aren\'t selfies.',
      categories: ['arts'], vibes: ['romantic'], time_slots: ['morning', 'afternoon', 'evening'], duration_min: 60,
      venue: 'Marina Bay', address: 'Marina Bay', postal_code: '018956', lat: 1.2856, lng: 103.8590, kid_friendly: true,
      image_url: img('fdcb70315d9c6027f3ae49463302a84613a71d84bff9d59bf5c90c21e133418b.jpg/68.jpg') }),
    G({ id: 'gyg-uss', name: 'Universal Studios Singapore day', slug: 'universal-studios-singapore-entrance-ticket-t66117/', usd: 54.7, rating: '4.3 (1,692)',
      short_description: 'Rides, shows and themed zones on Sentosa. Scream together on the coasters, then share churros.',
      categories: ['events', 'sports'], vibes: ['adventurous'], time_slots: ['morning'], duration_min: 480,
      venue: 'Universal Studios Singapore, Sentosa', address: '8 Sentosa Gateway', postal_code: '098269', lat: 1.2540, lng: 103.8238, kid_age_min: 3,
      image_url: img('b1ba01e967f17467832d96151587a26c69bf13b53b5f852288943e8151850143.png/68.jpg') }),
    G({ id: 'gyg-bigbus', name: 'Big Bus hop-on hop-off city tour', slug: 'singapore-big-bus-hop-on-hop-off-tour-by-open-top-bus-t204940/', usd: 52.36, rating: '4.5 (4,023)',
      short_description: 'See the city from an open-top deck and hop off wherever looks fun. Good for a lazy, no-plan day.',
      categories: ['tours', 'chill'], vibes: ['chill', 'first-date'], time_slots: ['morning', 'afternoon'], duration_min: 240,
      venue: 'Suntec City (main stop)', address: '3 Temasek Blvd', postal_code: '038983', lat: 1.2950, lng: 103.8590,
      image_url: img('5d932431cfe95.jpeg/68.jpg') })
  ];
})();
