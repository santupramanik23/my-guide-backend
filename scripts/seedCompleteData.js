import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Place } from '../models/Place.js';
import { Activity } from '../models/Activity.js';
import { User } from '../models/User.js';
import { Booking } from '../models/Booking.js';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO = process.env.MONGO_URL;
if (!MONGO) {
  console.error('❌ MONGO_URL missing in .env');
  process.exit(1);
}

// -------------------- Sample Data --------------------

// Places Data
const PLACES_RAW = [
  { id: '1', name: 'Victoria Memorial', category: 'cultural', city: 'Kolkata', country: 'India', featured: true, images: ['https://images.unsplash.com/photo-1651651166379-06540f274707?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1548'], description: 'Iconic marble building and museum dedicated to Queen Victoria' },
  { id: '2', name: 'Howrah Bridge', category: 'cultural', city: 'Kolkata', country: 'India', featured: true, images: ['https://images.unsplash.com/photo-1677307816181-1446ab18913e?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8aG93cmFoJTIwYnJpZGdlfGVufDB8fDB8fHww&auto=format&fit=crop&q=60&w=1600'], description: 'Famous cantilever bridge over Hooghly River' },
  { id: '3', name: 'Prinsep Ghat', category: 'nature', city: 'Kolkata', country: 'India', featured: false, images: ['https://images.unsplash.com/photo-1571679654681-ba01b9e1e117?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1548'], description: 'Scenic riverside ghat with colonial architecture' },
  { id: '4', name: 'Marble Palace', category: 'art', city: 'Kolkata', country: 'India', featured: false, images: ['https://dynamic-media-cdn.tripadvisor.com/media/photo-o/0c/c6/23/83/fountain-outside-the.jpg?w=1100&h=-1&s=1'], description: 'Neoclassical mansion with art collection' },
  { id: '5', name: 'Jorasanko Thakur Bari', category: 'cultural', city: 'Kolkata', country: 'India', featured: true, images: ['https://images.unsplash.com/photo-1578662996442-48f60103fc96'], description: 'Birthplace of Rabindranath Tagore' },
  { id: '6', name: 'Indian Museum', category: 'art', city: 'Kolkata', country: 'India', featured: false, images: ['https://dynamic-media-cdn.tripadvisor.com/media/photo-o/09/5c/6a/7b/jorasanko-thakur-bari.jpg?w=1100&h=-1&s=1'], description: 'Oldest and largest museum in India' },
  { id: '7', name: 'Dakshineswar Kali Temple', category: 'spiritual', city: 'Kolkata', country: 'India', featured: true, images: ['https://images.unsplash.com/photo-1578662996442-48f60103fc96'], description: 'Hindu temple dedicated to Goddess Kali' },
  { id: '8', name: 'Belur Math', category: 'spiritual', city: 'Kolkata', country: 'India', featured: false, images: ['https://dynamic-media-cdn.tripadvisor.com/media/photo-o/09/0f/f6/bf/dakshineswar-kali-temple.jpg?w=1000&h=-1&s=1'], description: 'Headquarters of Ramakrishna Mission' },
  { id: '9', name: 'College Street(Boi Para)', category: 'cultural', city: 'Kolkata', country: 'India', featured: false, images: ['https://dynamic-media-cdn.tripadvisor.com/media/photo-o/0e/2c/17/a2/books.jpg?w=1400&h=-1&s=1'], description: 'Famous street of books and educational institutions' },
  { id: '10', name: 'Park Street', category: 'food', city: 'Kolkata', country: 'India', featured: true, images: ['https://images.unsplash.com/photo-1709435739782-5e1d7002b609?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fFBhcmslMjBTdHJlZXQlMjBrb2xrYXRhfGVufDB8fDB8fHww&auto=format&fit=crop&q=60&w=900'], description: 'Popular street for restaurants and nightlife' },
  { id: '11', name: 'Metropolitan Building', category: 'architectural', city: 'Kolkata', country: 'India', featured: false, images: ['https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Metropolitan_Building%2C_Esplanade_Kolkata_%28Original%29.jpg/2560px-Metropolitan_Building%2C_Esplanade_Kolkata_%28Original%29.jpg'], description: 'Historic colonial-era building' },
  { id: '12', name: 'St. Paul\'s Cathedral', category: 'architectural', city: 'Kolkata', country: 'India', featured: false, images: ['https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/St_Paul%27s_Cathedral.jpg/2560px-St_Paul%27s_Cathedral.jpg'], description: 'Anglican cathedral with Gothic architecture' },
  { id: '13', name: 'Town Hall', category: 'architectural', city: 'Kolkata', country: 'India', featured: false, images: ['https://dynamic-media-cdn.tripadvisor.com/media/photo-o/09/93/11/2f/the-building.jpg?w=1400&h=-1&s=1'], description: 'Historic building in Greek Revival style' },
  { id: '14', name: 'Writers\' Building', category: 'cultural', city: 'Kolkata', country: 'India', featured: false, images: ['https://kolkatatourism.travel/images/places-to-visit/headers/writers-building-kolkata-tourism-entry-fee-timings-holidays-reviews-header.jpg'], description: 'Former office of the Chief Minister of West Bengal' },
  { id: '15', name: 'Kalighat Temple', category: 'spiritual', city: 'Kolkata', country: 'India', featured: false, images: ['https://www.trawell.in/admin/images/upload/555418767Kolkata_Kalighat_Temple_Main.jpg'], description: 'Hindu temple dedicated to Goddess Kali' },
  { id: '16', name: 'Pareshnath Jain Temple', category: 'spiritual', city: 'Kolkata', country: 'India', featured: false, images: ['https://dynamic-media-cdn.tripadvisor.com/media/photo-o/0d/e8/f1/49/jain-temple-full-of-glitter.jpg?w=2000&h=-1&s=1'], description: 'Beautiful Jain temple with intricate glasswork' },
  { id: '17', name: 'Armenian Church of Nazareth', category: 'spiritual', city: 'Kolkata', country: 'India', featured: false, images: ['https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Armenian_Church%2C_Calcutta_%28Kolkata%29_04.JPG/500px-Armenian_Church%2C_Calcutta_%28Kolkata%29_04.JPG'], description: 'Oldest Armenian church in Kolkata' },
  { id: '18', name: 'Academy of Fine Arts', category: 'art', city: 'Kolkata', country: 'India', featured: false, images: ['https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Academy_of_Fine_Arts_-_2_Cathedral_Road_-_Kolkata_2014-09-16_7946-7950_Archive.tif/lossy-page1-520px-Academy_of_Fine_Arts_-_2_Cathedral_Road_-_Kolkata_2014-09-16_7946-7950_Archive.tif.jpg'], description: 'Premier art institution in Kolkata' },
  { id: '19', name: 'Nandan & Rabindra Sadan', category: 'entertainment', city: 'Kolkata', country: 'India', featured: false, images: ['https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Nandan_-_Kolkata_2011-01-09_0153.JPG/960px-Nandan_-_Kolkata_2011-01-09_0153.JPG'], description: 'Cultural complex for films and performances' },
  { id: '20', name: 'Birla Planetarium', category: 'entertainment', city: 'Kolkata', country: 'India', featured: false, images: ['https://www.trawell.in/admin/images/upload/56457883Kolkata_Birla_Planetarium_Main.jpg'], description: 'Largest planetarium in Asia' },
  { id: '21', name: 'Science City', category: 'entertainment', city: 'Kolkata', country: 'India', featured: false, images: ['https://kolkatatourism.in/wp-content/uploads/2024/04/Science-City-Kolkata.webp'], description: 'Science museum and educational center' },
  { id: '22', name: 'Kolkata Tram Route', category: 'cultural', city: 'Kolkata', country: 'India', featured: false, images: ['https://img.staticmb.com/mbcontent/images/crop/uploads/2023/2/kolkata-tram_0_1200.jpg.webp'], description: 'Heritage tram ride through the city' },
  { id: '23', name: 'Maidan', category: 'nature', city: 'Kolkata', country: 'India', featured: false, images: ['https://sceneloc8.com/wp-content/uploads/2024/03/5-44.png'], description: 'Large urban park in central Kolkata' },
  { id: '24', name: 'Botanical Garden (Shibpur)', category: 'nature', city: 'Kolkata', country: 'India', featured: false, images: ['https://imgstaticcontent.lbb.in/lbbnew/wp-content/uploads/2017/09/28122847/banyan-tree-feat-%5E.jpg'], description: 'Botanical gardens with the Great Banyan Tree' },
  { id: '25', name: 'Alipore Zoo', category: 'nature', city: 'Kolkata', country: 'India', featured: false, images: ['https://images.bhaskarassets.com/web2images/1884/2025/05/05/whatsapp-image-2025-05-04-at-62556-pm_1746448112.jpeg'], description: 'Oldest zoological park in India' },
  { id: '26', name: 'Eco Park (New Town)', category: 'nature', city: 'Kolkata', country: 'India', featured: false, images: ['https://i.pinimg.com/736x/4a/10/99/4a109997d0fca3fdb1ca4dec47ccf723.jpg'], description: 'Urban ecological park with recreational facilities' },
  { id: '27', name: 'Nicco Park', category: 'entertainment', city: 'Kolkata', country: 'India', featured: false, images: ['https://dynamic-media-cdn.tripadvisor.com/media/photo-o/2b/66/de/78/cyclone-wooden-roller.jpg?w=1400&h=-1&s=1'], description: 'Amusement park with rides and attractions' },
  { id: '28', name: 'New Market', category: 'shopping', city: 'Kolkata', country: 'India', featured: false, images: ['https://upload.wikimedia.org/wikipedia/commons/3/37/New_Market%2C_Kolkata%2C_2011.jpg'], description: 'Historic shopping destination' },
  { id: '29', name: 'Burrabazar', category: 'shopping', city: 'Kolkata', country: 'India', featured: false, images: ['https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/A_view_of_Burrabazar_and_Mahatma_Gandhi_Road.jpg/1920px-A_view_of_Burrabazar_and_Mahatma_Gandhi_Road.jpg'], description: 'One of the largest wholesale markets in India' },
  { id: '30', name: 'Chinatown (Tiretta Bazaar & Tangra)', category: 'food', city: 'Kolkata', country: 'India', featured: false, images: ['https://dynamic-media-cdn.tripadvisor.com/media/photo-o/07/bc/15/56/tangra-chinatown.jpg?w=1600&h=-1&s=1'], description: 'Historic Chinese neighborhood with authentic cuisine' },
];

// Transform places properly (keeping all fields)
const PLACES = PLACES_RAW.map(({ id, ...rest }) => ({
  ...rest, // This preserves category, featured, and all other fields
  location: {
    type: 'Point',
    coordinates: [getRandomLongitude(), getRandomLatitude()], // [lng, lat]
  },
  tags: [rest.category, ...(rest.featured ? ['featured'] : [])],
  isActive: true,
}));

// Activities Data - using only categories that exist in Activity schema
const ACTIVITIES = [
  {
    id: '1',
    title: 'Victoria Memorial Heritage Walk & Museum Tour',
    category: 'cultural',
    price: 549,
    durationMinutes: 90,
    placeId: '1', // Maps to Victoria Memorial
    featured: true,
    isPublished: true,
    images: ['https://www.tourmyindia.com/blog//wp-content/uploads/2018/04/Morning-Walk-at-Victoria-Memorial.jpg'],
    description: 'Explore the iconic Victoria Memorial with expert guide commentary on British colonial history and architecture.',
    capacity: 25,
    tags: ['heritage', 'museum', 'colonial', 'history']
  },
  {
    id: '2',
    title: 'Botanical Garden Nature Photography Walk',
    category: 'nature',
    price: 699,
    durationMinutes: 150,
    placeId: '24', // Maps to Botanical Garden (Shibpur)
    featured: true,
    isPublished: true,
    images: ['https://assets.telegraphindia.com/telegraph/2023/Sep/1694250716_activity-1.jpg'],
    description: 'Photograph exotic flora including the famous Great Banyan Tree with professional guidance.',
    capacity: 18,
    tags: ['photography', 'banyan tree', 'flora', 'nature']
  },
  {
    id: '3',
    title: 'Alipore Zoo Wildlife Conservation Tour',
    category: 'nature',
    price: 549,
    durationMinutes: 120,
    placeId: '25', // Maps to Alipore Zoo
    featured: false,
    isPublished: true,
    images: ['https://kolkatazoo.in/web/images/footer.jpg'],
    description: 'Educational tour focusing on wildlife conservation efforts at India\'s oldest zoo.',
    capacity: 25,
    tags: ['wildlife', 'conservation', 'zoo', 'education']
  },
  {
    id: '4',
    title: 'Eco Park Cycling & Nature Adventure',
    category: 'adventure',
    price: 749,
    durationMinutes: 120,
    placeId: '26', // Maps to Eco Park (New Town)
    featured: true,
    isPublished: true,
    images: ['https://ecoparknewtown.com/assets/frontend/img/Duo-Cycling_02.jpg'],
    description: 'Cycle through themed gardens, enjoy boating, and experience adventure activities.',
    capacity: 20,
    tags: ['cycling', 'boating', 'adventure', 'themed gardens']
  },
  {
    id: '5',
    title: 'Nicco Park Adventure Rides Experience',
    category: 'entertainment',
    price: 999,
    durationMinutes: 240,
    placeId: '27', // Maps to Nicco Park
    featured: false,
    isPublished: true,
    images: ['https://www.niccoparks.com/wp-content/uploads/2024/09/Get-the-ultimate-Fun-at-Nicco-park.webp'],
    description: 'Full day of thrilling rides, water sports, and entertainment at Kolkata\'s premier amusement park.',
    capacity: 30,
    tags: ['amusement park', 'rides', 'water sports', 'thrilling']
  },
  {
    id: '6',
    title: 'Science City Interactive Space & Robotics Experience',
    category: 'fun',
    price: 899,
    durationMinutes: 180,
    placeId: '21', // Maps to Science City
    featured: true,
    isPublished: true,
    images: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTSgYo8eCG1pSn-Yj3Tapj3sGjuD_fkk5aCgQ&s'],
    description: 'Explore interactive exhibits, space theater, evolution park, and cutting-edge robotics demonstrations.',
    capacity: 40,
    tags: ['science', 'space', 'robotics', 'interactive', 'education']
  },
  {
    id: '7',
    title: 'Quest Escape Room Team Challenge',
    category: 'games',
    price: 1499,
    durationMinutes: 90,
    placeId: '10', // Maps to Park Street
    featured: true,
    isPublished: true,
    images: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS_7npziAOVePeMyTuctp_tVRLgTh1iGnebJw&s'],
    description: 'Solve thrilling puzzles and mysteries in themed escape rooms with your team in Park Street.',
    capacity: 8,
    tags: ['escape room', 'puzzle', 'team building', 'mystery', 'thriller']
  },
  {
    id: '8',
    title: 'Smaaash Entertainment Zone - VR & Arcade Gaming',
    category: 'games',
    price: 1299,
    durationMinutes: 120,
    placeId: '10', // Maps to Park Street
    featured: true,
    isPublished: true,
    images: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:GcQdU0g2Rs9LXPQ3L8Xww0Pgq50_CfH1nN7qKw&s'],
    description: 'Virtual reality experiences, cricket simulator, bowling, and arcade games at premium entertainment center.',
    capacity: 25,
    tags: ['vr gaming', 'arcade', 'bowling', 'cricket simulator', 'entertainment']
  },
  {
    id: '9',
    title: 'Paintball Combat & Laser Tag Adventure',
    category: 'adventure',
    price: 1099,
    durationMinutes: 120,
    placeId: '27', // Maps to Nicco Park
    featured: false,
    isPublished: true,
    images: ['https://content.jdmagicbox.com/v2/comp/mumbai/c9/022pxx22.xx22.230401040738.u8c9/catalogue/pro-paintball-and-laser-tag-mumbai-adventure-sports-h5iy4m5uuu-250.jpg'],
    description: 'Tactical outdoor paintball battles and high-tech laser tag combat in specially designed arenas.',
    capacity: 20,
    tags: ['paintball', 'laser tag', 'outdoor', 'team sport', 'combat']
  },
  {
    id: '10',
    title: 'Go-Karting Racing Experience at Nicco Gokart Track',
    category: 'adventure',
    price: 849,
    durationMinutes: 60,
    placeId: '27', // Maps to Nicco Park
    featured: true,
    isPublished: true,
    images: ['https://beyondenoughag8.s3.ap-south-1.amazonaws.com/dynamic/album1.pngbeimg0lo6x4f1v.png'],
    description: 'Feel the adrenaline rush on professional go-kart racing track with timed laps and competitions.',
    capacity: 15,
    tags: ['go-karting', 'racing', 'adrenaline', 'speed', 'competitive']
  },
  {
    id: '11',
    title: 'Premium Bowling Night at INOX',
    category: 'games',
    price: 799,
    durationMinutes: 90,
    placeId: '10', // Maps to Park Street
    featured: false,
    isPublished: true,
    images: ['https://content.jdmagicbox.com/comp/def_content_category/bowling-alleys/61193c0ac1-bowling-alleys-3-bygcu.jpg'],
    description: 'Enjoy bowling with friends at state-of-the-art lanes with music, lights, and refreshments.',
    capacity: 20,
    tags: ['bowling', 'indoor', 'social', 'entertainment', 'premium']
  },
  {
    id: '12',
    title: 'Stand-Up Comedy Night at Canvas Laugh Club',
    category: 'entertainment',
    price: 649,
    durationMinutes: 120,
    placeId: '10', // Maps to Park Street
    featured: true,
    isPublished: true,
    images: ['https://res.cloudinary.com/https-highape-com/image/upload/q_auto:eco,f_auto,h_380/v1533556917/nkcj18okp3tqubjvefne.jpg'],
    description: 'Laugh out loud with India\'s top comedians performing live stand-up comedy shows.',
    capacity: 100,
    tags: ['comedy', 'stand-up', 'live show', 'entertainment', 'laughter']
  },
  {
    id: '13',
    title: 'Board Game Cafe Strategy Gaming Session',
    category: 'games',
    price: 449,
    durationMinutes: 150,
    placeId: '10', // Maps to Park Street
    featured: false,
    isPublished: true,
    images: ['https://imgstaticcontent.lbb.in/lbbnew/wp-content/uploads/2017/08/28105729/Gamerheads_28-08-17_01.jpg'],
    description: 'Play hundreds of board games from classics to modern strategy games with expert game masters.',
    capacity: 12,
    tags: ['board games', 'strategy', 'cafe', 'social', 'gaming']
  },
  {
    id: '14',
    title: 'Virtual Reality Gaming Zone Ultimate Pass',
    category: 'games',
    price: 999,
    durationMinutes: 120,
    placeId: '10', // Maps to Park Street
    featured: true,
    isPublished: true,
    images: ['https://images.jdmagicbox.com/quickquotes/listicle/listicle_1701868764341_ipt9b_5819x3879.jpg'],
    description: 'Experience cutting-edge VR games including zombie shooters, racing simulators, and adventure worlds.',
    capacity: 10,
    tags: ['virtual reality', 'vr games', 'immersive', 'technology', 'gaming']
  },
  {
    id: '15',
    title: 'Eden Gardens Cricket Stadium Tour & Net Practice',
    category: 'sports',
    price: 1499,
    durationMinutes: 120,
    placeId: '23', // Maps to Maidan
    featured: true,
    isPublished: true,
    images: ['https://cricketcupworld.com/wp-content/uploads/2024/03/Eden-Garden-stadium-.webp'],
    description: 'Tour the iconic cricket stadium and enjoy professional net practice with coaching tips.',
    capacity: 15,
    tags: ['cricket', 'stadium tour', 'sports', 'net practice', 'iconic']
  },
  {
    id: '16',
    title: 'Gaming Cafe Esports Tournament',
    category: 'games',
    price: 699,
    durationMinutes: 180,
    placeId: '10', // Maps to Park Street
    featured: false,
    isPublished: true,
    images: ['https://sm.ign.com/ign_in/screenshot/default/mobile-gaming-3_gsmk.jpg'],
    description: 'Compete in PC gaming tournaments featuring popular titles like DOTA 2, CS:GO, and Valorant.',
    capacity: 30,
    tags: ['esports', 'pc gaming', 'tournament', 'competitive', 'multiplayer']
  },
  {
    id: '17',
    title: 'Magic Show & Interactive Performance Experience',
    category: 'entertainment',
    price: 599,
    durationMinutes: 90,
    placeId: '19', // Maps to Nandan & Rabindra Sadan
    featured: false,
    isPublished: true,
    images: ['https://cdn-jlbhl.nitrocdn.com/CDPaTLXtnfTkWjSUujUrRZWwoAJJuhgY/assets/images/optimized/rev-5103ba8/christopherhowell.net/blog/wp-content/uploads/2022/11/Theatre-Magic-Show-Rabbits-Out-of-the-Hat-1.jpg'],
    description: 'Family-friendly magic show with mind-blowing illusions and audience participation.',
    capacity: 50,
    tags: ['magic', 'illusion', 'family', 'interactive', 'performance']
  },
  {
    id: '18',
    title: 'Roller Skating Session at Eco Park Arena',
    category: 'fun',
    price: 399,
    durationMinutes: 90,
    placeId: '26', // Maps to Eco Park (New Town)
    featured: false,
    isPublished: true,
    images: ['https://ecoparknewtown.com/assets/frontend/img/roller-skates_05.jpg'],
    description: 'Enjoy roller skating with friends and family at well-maintained outdoor skating rink.',
    capacity: 40,
    tags: ['roller skating', 'outdoor', 'family', 'exercise', 'fun']
  },
  {
    id: '19',
    title: 'Adventure Mini Golf Championship',
    category: 'fun',
    price: 549,
    durationMinutes: 75,
    placeId: '26', // Maps to Eco Park (New Town)
    featured: false,
    isPublished: true,
    images: ['https://www.phuketadventureminigolf.com/wp-content/uploads/hole-14-phuket-adventure-mini-golf-20-1140x760.jpg'],
    description: 'Navigate through 18 holes of themed mini-golf with challenging obstacles and scenic designs.',
    capacity: 16,
    tags: ['mini golf', 'adventure', 'family', 'outdoor', 'competitive']
  },
  {
    id: '20',
    title: 'Trampoline Park Jump & Flip Experience',
    category: 'fun',
    price: 699,
    durationMinutes: 90,
    placeId: '27', // Maps to Nicco Park
    featured: true,
    isPublished: true,
    images: ['https://assets.telegraphindia.com/telegraph/2024/Nov/1731582208_image-2.jpg'],
    description: 'Bounce, flip, and play in massive trampoline park with dodgeball area and foam pits.',
    capacity: 30,
    tags: ['trampoline', 'jumping', 'fitness', 'fun', 'active']
  },
  {
    id: '21',
    title: 'Rock Climbing & Wall Rappelling Adventure',
    category: 'adventure',
    price: 999,
    durationMinutes: 120,
    placeId: '27', // Maps to Nicco Park
    featured: true,
    isPublished: true,
    images: ['https://imgstaticcontent.lbb.in/lbbnew/wp-content/uploads/2017/12/13115258/himalayas-beckon-%5E.jpg'],
    description: 'Challenge yourself with indoor rock climbing and rappelling under professional supervision.',
    capacity: 12,
    tags: ['rock climbing', 'rappelling', 'adventure', 'fitness', 'challenge']
  }
].map(({ id, placeId, featured, isPublished, ...rest }) => ({
  ...rest,
  placeId, // Keep for mapping to ObjectId later
  featured: !!featured,
  isPublished: !!isPublished,
  isActive: isPublished !== false,
  averageRating: Math.random() * 2 + 3, // Random rating between 3-5
  totalReviews: Math.floor(Math.random() * 100), // Random review count
}));

const USERS = [
  {
    name: 'Demo Guide',
    email: 'demo@guide.com',
    role: 'guide',
    avatar: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1740'
  },
  {
    name: 'Koushik Bala',
    email: 'koushik@gmail.com',
    role: 'admin',
    avatar: 'https://scontent.fccu31-2.fna.fbcdn.net/v/t39.30808-6/309928274_3215167642030725_717522874565195362_n.jpg?_nc_cat=103&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=rtm4jnOz6dcQ7kNvwEGOgeU&_nc_oc=AdmfUO1ToaiL_7ck_-brtMwl5N7BGS1MuUWiOWudsK4adl7_uF790rMznZmBTCA5J7w&_nc_zt=23&_nc_ht=scontent.fccu31-2.fna&_nc_gid=WBtUQFhp9H-MDRiRXKhI0Q&oh=00_AfeDUwfk5s-9H6PazRv_G0HBUqIMMLs7KPllrJetEu3kCg&oe=6905467D'
  },
  {
    name: 'Swapnanil Dey',
    email: 'swapnanil@gmail.com',
    role: 'traveller',
    avatar: 'https://scontent.fccu31-1.fna.fbcdn.net/v/t39.30808-1/480785663_605719469105503_4304257207675441090_n.jpg?stp=dst-jpg_s480x480_tt6&_nc_cat=100&ccb=1-7&_nc_sid=1d2534&_nc_ohc=lZv25Ss_YFoQ7kNvwGnSw9L&_nc_oc=AdkR9dZz81Key33NFvWkwc5AXA6U8AXImCPvZI3rsQ-HnHv-EdjwTB2xf7auuumAVuI&_nc_zt=24&_nc_ht=scontent.fccu31-1.fna&_nc_gid=mJAgieE82I7ATYqWPD7ZJw&oh=00_Afcqz2NO38ivJbUas4SVwYRDNX1kDi16Zkbc5BZ5eFvAqQ&oe=6905318A'
  },
  {
    name: 'Subhranil Banerjee',
    email: 'subhranil@gmail.com',
    role: 'traveller',
    avatar: 'https://scontent.fccu31-2.fna.fbcdn.net/v/t39.30808-6/531821398_24239095389076134_7209774263349976143_n.jpg?_nc_cat=106&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=TUXRpWul-xsQ7kNvwEPOYQq&_nc_oc=AdmZ9Ah7ct8ERq113gKjMgllBS2x8tUY5KbzGSepGQZaOgLxSgXWr-zmS5h_TaxHcBg&_nc_zt=23&_nc_ht=scontent.fccu31-2.fna&_nc_gid=ilqipHD0Se_jFAuz8yzrUA&oh=00_AffHx9C-a5E3kLZxQ6FYFc7OaCYvS2ehLrNc-pqJ6w6JLQ&oe=69052B3B'
  },
  {
    name: 'Boby Peter Mondal',
    email: 'boby@gmail.com',
    role: 'guide',
    avatar: 'https://scontent.fccu31-2.fna.fbcdn.net/v/t39.30808-1/471397609_8880526372031196_1278100693986848278_n.jpg?stp=dst-jpg_s480x480_tt6&_nc_cat=106&ccb=1-7&_nc_sid=e99d92&_nc_ohc=7v3eoUFlFgsQ7kNvwFgd5gd&_nc_oc=AdlhZYIFaNKH-Sy69kDQLAot065vfn_eh6FVhna9r85TwCDrqjJK9BSIFpZg5fj5TsI&_nc_zt=24&_nc_ht=scontent.fccu31-2.fna&_nc_gid=pG6MexD9KsH9hepGeyE5ig&oh=00_AfcFPOHSQIw9-HcSYoB-fWeGen_tt3mUx_6cGfAifsQ2Ug&oe=690558E5'
  },
  {
    name: 'Demo Instructor',
    email: 'demo@instructor.com',
    role: 'instructor',
    avatar: 'https://plus.unsplash.com/premium_photo-1671656349322-41de944d259b?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=774'
  },
  {
    name: 'DJ Rana',
    email: 'djrana@gmail.com',
    role: 'instructor',
    avatar: 'https://scontent.fccu31-2.fna.fbcdn.net/v/t39.30808-6/255080519_103858148779296_3797659908147071793_n.jpg?_nc_cat=103&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=1dgZBxCHeZ8Q7kNvwH2akSQ&_nc_oc=AdkFKcPkQGhpUPtfPP_IPjMoTJ9ExLQ0CFuG2BCTk1z3RkMsAJEq59zwvhG13qMGjGQ&_nc_zt=23&_nc_ht=scontent.fccu31-2.fna&_nc_gid=KBPaN5jspYEDpzOg1P4tkg&oh=00_AfegTPJ7dPfT2oYA_bZENHCsXf6f7c5vSVHsuI7PqvaYgA&oe=69052712'
  },
  {
    name: 'Demo Traveller',
    email: 'demo@traveller.com',
    role: 'traveller',
    avatar: 'https://images.unsplash.com/photo-1615109398623-88346a601842?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=774'
  },
  {
    name: 'Dibpriya Jana',
    email: 'dibpriya@gmail.com',
    role: 'guide',
    avatar: 'https://scontent.fccu31-1.fna.fbcdn.net/v/t39.30808-6/480887995_1309961500237143_3549249855263815429_n.jpg?_nc_cat=107&ccb=1-7&_nc_sid=127cfc&_nc_ohc=csugrhnzuQoQ7kNvwFl0z4v&_nc_oc=Adn9obLWLt5v5L5uphEHaudxnhRHnvnoh1JEgPq0PeC_hpFwD8DtwTsJygAFYrYDbVU&_nc_zt=23&_nc_ht=scontent.fccu31-1.fna&_nc_gid=k60R6EDtylL2NAutFe0-wA&oh=00_AfeY2JnwM5bYLP1nfr3Kcheq4oLWT2pnZ91L_K3a8r1Oyg&oe=690531CA'
  },
  {
    name: 'Srijon Karmakar',
    email: 'srijon@gmail.com',
    role: 'traveller',
    avatar: 'https://scontent.fccu31-1.fna.fbcdn.net/v/t39.30808-6/558765409_122170760354437095_82785092627148553_n.jpg?_nc_cat=101&ccb=1-7&_nc_sid=a5f93a&_nc_ohc=mSBt8oV8fEkQ7kNvwGhO_lJ&_nc_oc=AdmM_MIi5ce9JRMKm7mG66Dem16HRAElqvU5c22K7VHSdDis48fWRK2gZhIHuX1PSrw&_nc_zt=23&_nc_ht=scontent.fccu31-1.fna&_nc_gid=8AvbeLOo0btgWzmkbD_kHQ&oh=00_Affvb1rtmigTzOMiTxVw3YzDCq2X9B_0GGE_0RVaFbe7XA&oe=690544B8'
  },
  {
    name: 'Nandini Biswas',
    email: 'nandini@gmail.com',
    role: 'instructor',
    avatar: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQrZzOGMKw9mf9ppchL_FaPg8GfM78t9qVvZQ&s'
  },
  {
    name: 'Salini Chowdhury',
    email: 'salini@gmail.com',
    role: 'traveller',
    avatar: 'https://scontent.fccu31-2.fna.fbcdn.net/v/t39.30808-6/492015501_2309200022814862_4067844058864446006_n.jpg?_nc_cat=103&ccb=1-7&_nc_sid=833d8c&_nc_ohc=TsDvQgjPxI0Q7kNvwFlsDDA&_nc_oc=Admw9pesU43xHZ9hTz8827S5J-mMokkyvfEwHuSVfLYGdzs9dZRvwaqg9aNbNljCtE4&_nc_zt=23&_nc_ht=scontent.fccu31-2.fna&_nc_gid=9AUqb6HsKLklX8X_JMPMdw&oh=00_Afeg0wGltY9uy9y1E9Inxy8p3rn-dQFr2wTNnJKfx_2dCg&oe=690531DC'
  },
  {
    name: 'Rahul Panja(Gopal)',
    email: 'rahul.Panja@gmail.com',
    role: 'guide',
    avatar: 'https://scontent.fccu31-2.fna.fbcdn.net/v/t39.30808-6/548200324_122176103072379721_9072129144990627289_n.jpg?_nc_cat=109&ccb=1-7&_nc_sid=833d8c&_nc_ohc=4hW5yaLXiGoQ7kNvwHHZIFr&_nc_oc=Adl5qcTm4ZJnnD3RQzlsEpQ7UKiHKVTYdDp_wGUBW0U4745xTe7jcxM-F7WzYb4hQ48&_nc_zt=23&_nc_ht=scontent.fccu31-2.fna&_nc_gid=Tkp-64Rj2KvMF3bvDID0Kg&oh=00_AfdWX6x8Cxhbq8nh7qouQ9tm3gsd3p8RPl9VkqhcDU2atA&oe=690526BC'
  }
].map(({ id, avatar, createdAt, ...rest }) => ({
  ...rest,
  password: 'admin@123', // will be hashed
  verified: true,
  isActive: true,
  status: 'active',
  avatarUrl: avatar,
}));

// -------------------- Helpers --------------------
function getRandomLongitude() {
  // Kolkata approx: 88.2–88.5
  return 88.2 + Math.random() * 0.3;
}

function getRandomLatitude() {
  // Kolkata approx: 22.45–22.7
  return 22.45 + Math.random() * 0.25;
}

// -------------------- Seed Runner --------------------
async function seedCompleteData() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGO);
  console.log('✅ Connected to MongoDB');

  try {
    console.log('🗑️ Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Place.deleteMany({}),
      Activity.deleteMany({}),
      Booking.deleteMany({}),
    ]);

    // Users
    console.log('👥 Adding users...');
    const createdUsers = [];
    for (const userData of USERS) {
      const hash = await bcrypt.hash(userData.password, 12);
      const user = new User({ ...userData, password: hash });
      await user.save();
      createdUsers.push(user);
      console.log(`✅ Added user: ${user.email} (${user.role})`);
    }

    // Places
    console.log('🏛️ Adding places...');
    const createdPlaces = [];
    const placeMap = new Map(); // old id -> new ObjectId
    for (const placeData of PLACES) {
      const place = new Place(placeData);
      await place.save();
      createdPlaces.push(place);
      // Store mapping using index-based ID (for PLACES_RAW)
      const originalId = PLACES_RAW[createdPlaces.length - 1].id;
      placeMap.set(originalId, place._id);
      console.log(`✅ Added place: ${place.name} (${place.category})`);
    }

    // Activities
    console.log('🎯 Adding activities...');
    const createdActivities = [];
    for (const activityData of ACTIVITIES) {
      const placeObjectId = placeMap.get(activityData.placeId);
      if (!placeObjectId) {
        console.warn(`⚠️ Skipping activity "${activityData.title}" – unknown placeId: ${activityData.placeId}`);
        continue;
      }

      // Ensure images are strings (URLs)
      const images = Array.isArray(activityData.images)
        ? activityData.images.map(String)
        : [];

      const activity = new Activity({
        title: activityData.title,
        description: activityData.description ?? '',
        category: activityData.category,
        price: Number(activityData.price) || 0,
        durationMinutes: Number(activityData.durationMinutes) || 60,
        place: placeObjectId, // ✅ Correct ref field name
        featured: !!activityData.featured,
        isPublished: !!activityData.isPublished,
        isActive: activityData.isActive !== false,
        capacity: Number(activityData.capacity) || 20, // ✅ Correct field name
        images,
        tags: Array.isArray(activityData.tags) ? activityData.tags : [],
        averageRating: Number(activityData.averageRating) || 0,
        totalReviews: Number(activityData.totalReviews) || 0,
      });

      await activity.save();
      createdActivities.push(activity);
      console.log(`✅ Added activity: ${activity.title} (${activity.category}) - ₹${activity.price}`);
    }

    // Bookings
    // console.log('📅 Adding bookings...');
    // const bookingStatuses = ['pending', 'confirmed', 'cancelled'];
    // for (let i = 0; i < 50; i++) {
    //   const randomUser = createdUsers[Math.floor(Math.random() * createdUsers.length)];
    //   const randomActivity = createdActivities[Math.floor(Math.random() * createdActivities.length)];
    //   if (!randomActivity) break;

    //   const booking = new Booking({
    //     user: randomUser._id,
    //     activity: randomActivity._id,
    //     date: new Date(Date.now() + i * 3 * 24 * 60 * 60 * 1000),
    //     peopleCount: Math.floor(Math.random() * 5) + 1,
    //     status: bookingStatuses[Math.floor(Math.random() * bookingStatuses.length)],
    //     notes: `Booking for ${randomActivity.title}`,
    //   });

    //   await booking.save();
    //   console.log(`✅ Added booking: ${randomUser.name} -> ${randomActivity.title}`);
    // }

    console.log('\n🎉 Complete data seeding finished!');
    console.log('📊 Summary:');
    console.log(`   Users: ${createdUsers.length}`);
    console.log(`   Places: ${createdPlaces.length}`);
    console.log(`   Activities: ${createdActivities.length}`);
    // console.log(`   Bookings: 50`);
    
    console.log('\n🏷️ Category Distribution:');
    const categoryCounts = {};
    createdActivities.forEach(activity => {
      categoryCounts[activity.category] = (categoryCounts[activity.category] || 0) + 1;
    });
    Object.entries(categoryCounts).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} activities`);
    });

  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

seedCompleteData();