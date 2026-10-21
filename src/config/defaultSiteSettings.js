const defaultSiteSettings = {
  siteName: 'Bismillah Spray Center',
  tagline: 'Premium Agricultural Solutions for Pakistan',
  siteLogo: '',
  contact: {
    whatsapp: '923001331616',
    phone: '+923001331616',
    email: 'zafarwattoo@gmail.com',
    address: 'Behramka Hithar Tehsil Minchinabad, Punjab, Pakistan',
    googleMapsEmbed: '',
    googleMaps: 'https://maps.app.goo.gl/fQ84ruXiC83vPDm1A',
  },
  social: {
    facebook: 'https://www.facebook.com/profile.php?id=100012235385727',
    instagram: 'https://www.instagram.com/muhammadzafarwattoo/',
    youtube: 'https://youtube.com/bismillahspraycenter',
  },
  businessHours: [
    { day: 'Monday - Saturday', hours: '8:00 AM - 8:00 PM' },
    { day: 'Sunday', hours: '9:00 AM - 2:00 PM' },
    { day: 'Peak Season', hours: '8:00 AM - 9:00 PM' },
  ],
  theme: {
    primary: '#1A3C2A',
    accent: '#E9A825',
  },
  media: { allowVideoUploads: true, maxVideoSizeMB: 100 },
  services: [
    { title: 'Crop Consultation', description: 'Sit down with our agronomists and get a season-long plan built around your soil, your crop, and the pests you actually face — not generic advice.', icon: 'GiFarmer' },
    { title: 'Pest Identification', description: 'Bring in a leaf, a photo, or a sample and we’ll name the pest or disease on the spot, then hand you the exact product and dose to stop it.', icon: 'GiMicroscope' },
    { title: 'Spraying Services', description: 'Skip the guesswork and the rented gear. Our trained team sprays your field with calibrated machines for even coverage and zero waste.', icon: 'GiSpray' },
    { title: 'Soil Testing', description: 'Know before you sow. We analyse your soil for nutrient gaps and tell you precisely which fertilizer your land needs this season.', icon: 'GiTestTubes' },
    { title: 'Equipment Repair', description: 'Broken sprayer before peak season? We service and repair all types of spray machines and farm equipment to keep you running.', icon: 'GiWrench' },
    { title: 'Bulk Orders', description: 'Farming at scale or buying for the whole village? Get wholesale pricing, priority stock, and delivery arranged to your doorstep.', icon: 'GiDeliveryDrone' },
  ],
  categories: {
    products: ['Insecticides', 'Herbicides', 'Fungicides', 'Fertilizers', 'Seeds'],
    faqs: ['General', 'Products', 'Orders', 'Usage', 'Shipping'],
    gallery: ['Products', 'Store', 'Events', 'Team', 'Other'],
  },
  homeContent: {
    headline: 'Grow Better. Harvest Stronger.',
    subheading: 'Genuine pesticides, fertilizers, seeds, and spray machines designed to help farmers protect yields, improve soil health, and grow with confidence.',
    yearsExperience: '8+',
    happyFarmers: '500+',
    productCount: '50+',
  },
  aboutStats: [
    { number: '8+', label: 'Years of Service' },
    { number: '500+', label: 'Happy Farmers' },
    { number: '50+', label: 'Products' },
    { number: '8+', label: 'Brand Partners' },
  ],
  milestones: [
    { year: '2018', title: 'Where It Began', description: 'Opened our doors in Minchinabad with a simple promise: only genuine products and honest advice for local farmers.' },
    { year: '2020', title: 'Growing With Our Farmers', description: 'Widened our shelves to carry trusted names like Warble, FFC and Engro as more growers made us their first stop.' },
    { year: '2021', title: 'Authorized Premium Partner', description: 'Earned authorized dealership for 8+ major agricultural brands — genuine stock, straight from the source.' },
    { year: '2025', title: 'Closer, Faster Service', description: 'Launched our website and WhatsApp ordering so advice and supplies are only a message away.' },
  ],
  cropSolutions: [
    { name: 'Cotton', description: 'Protect your crop from bollworm, whitefly, jassids, and seasonal disease pressure.' },
    { name: 'Wheat', description: 'Find the right seed treatment, fertilizer plan, and weed protection for stronger growth.' },
    { name: 'Rice', description: 'Get crop-care guidance for healthy seedlings, nutrient balance, and disease prevention.' },
    { name: 'Vegetables', description: 'Choose practical pest and fungal disease solutions for vegetables grown in the region.' },
  ],
};

export default defaultSiteSettings;
