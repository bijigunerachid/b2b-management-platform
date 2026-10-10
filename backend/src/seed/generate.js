// Pure, deterministic generator for realistic demo data.
// No database access here, so it can be unit tested.

const { PAYMENT_TERMS_DAYS, invoiceTotals, round2: roundMoney } = require("../billing/billing");

const STATUSES = ["Pending", "Processing", "Completed", "Cancelled"];

const FIRST_NAMES = [
    "Youssef", "Salma", "Amine", "Khadija", "Omar", "Fatima", "Mehdi", "Imane",
    "Hamza", "Sara", "Rachid", "Nadia", "Karim", "Laila", "Hicham", "Zineb",
    "Anas", "Meryem", "Ayoub", "Hajar", "Bilal", "Asmae", "Ilyas", "Ghita",
    "Reda", "Houda", "Tarik", "Siham", "Adil", "Loubna", "Soufiane", "Wiam",
    "Nabil", "Kenza", "Mourad", "Chaimae", "Driss", "Yasmine", "Hassan", "Rim"
];

const LAST_NAMES = [
    "Amrani", "Idrissi", "El Fassi", "Benali", "Alaoui", "Bennani", "Tazi",
    "Chraibi", "Berrada", "El Ouafi", "Lahlou", "Sqalli", "Kettani", "Ziani",
    "Haddad", "Mansouri", "El Khatib", "Ouazzani", "Benjelloun", "Saidi",
    "Naciri", "Belhaj", "Rami", "Azzouzi", "Tahiri", "Filali", "Bouzid",
    "El Amine", "Lazrak", "Cherkaoui"
];

// [city, weight] — larger business hubs get more customers.
const CITIES = [
    ["Casablanca", 22], ["Rabat", 10], ["Marrakech", 9], ["Agadir", 9],
    ["Tanger", 8], ["Fès", 7], ["Meknès", 4], ["Oujda", 3], ["Kénitra", 4],
    ["Tétouan", 3], ["Safi", 2], ["El Jadida", 3], ["Tiznit", 2], ["Nador", 2],
    ["Béni Mellal", 2], ["Laâyoune", 1], ["Essaouira", 1], ["Settat", 2]
];

const FOREIGN = [
    ["Paris", "France"], ["Lyon", "France"], ["Madrid", "Spain"],
    ["Barcelona", "Spain"], ["Dakar", "Senegal"], ["Tunis", "Tunisia"],
    ["Brussels", "Belgium"], ["Abidjan", "Côte d'Ivoire"]
];

const COMPANY_PREFIXES = [
    "Atlas", "Souss", "Maghreb", "Sahara", "Rif", "Oasis", "Argan", "Medina",
    "Kasbah", "Andalous", "Toubkal", "Bouregreg", "Tensift", "Draa", "Ziz",
    "Sebou", "Anfa", "Agdal", "Majorelle", "Chellah", "Ifrane", "Zagora",
    "Volubilis", "Mogador", "Atlantic", "Nova", "Prime", "Delta", "Horizon",
    "Global", "Royal", "Golden", "Cedar", "Palm", "Saffron", "Indigo"
];

const COMPANY_TYPES = [
    "Distribution", "Trading", "Supplies", "Logistics", "Industries",
    "Solutions", "Commerce", "Import Export", "Wholesale", "Services",
    "Equipment", "Group", "Partners", "Retail", "Technologies", "Holding"
];

const LEGAL_FORMS = ["SARL", "SA", "SARL AU", "SNC", ""];

const STREETS = [
    "Boulevard Mohammed V", "Avenue Hassan II", "Rue Ibn Battouta",
    "Boulevard Zerktouni", "Avenue des FAR", "Rue Allal Ben Abdellah",
    "Boulevard Abdelmoumen", "Avenue Mohammed VI", "Rue de Fès",
    "Zone Industrielle", "Quartier Industriel", "Parc d'Activités",
    "Avenue Moulay Youssef", "Rue Tarik Ibn Ziad"
];

// Each category: [name, description, price range [min, max], product names, variants]
const CATALOG = [
    ["Electronics", "Devices, peripherals and accessories", [80, 4500],
        ["Wireless Mouse", "Mechanical Keyboard", "27\" Monitor", "USB-C Hub", "Webcam HD", "Laptop Stand", "Noise-Cancelling Headset", "External SSD", "Docking Station", "Portable Speaker"],
        ["Pro", "Lite", "Max", "V2", "Plus", "Mini"]],
    ["Office Supplies", "Paper, writing and desk essentials", [5, 260],
        ["A4 Paper Pack", "Ballpoint Pens", "Sticky Notes", "Stapler", "Binder Clips", "Highlighters", "Ring Binder", "Desk Organizer", "Envelopes", "Notebook"],
        ["Box of 10", "Box of 50", "Premium", "Eco", "Assorted", "Bulk"]],
    ["Furniture", "Office furniture and fittings", [450, 9500],
        ["Ergonomic Chair", "Standing Desk", "Filing Cabinet", "Meeting Table", "Bookshelf", "Reception Sofa", "Storage Locker", "Drawer Unit", "Visitor Chair", "Workstation"],
        ["Oak", "Black", "White", "Walnut", "Grey", "Executive"]],
    ["Networking", "Routers, switches and cabling", [60, 7800],
        ["Gigabit Switch", "Wi-Fi Router", "Access Point", "Patch Panel", "Cat6 Cable", "Network Rack", "PoE Injector", "Firewall Appliance", "Mesh Kit", "Fiber Transceiver"],
        ["8-Port", "24-Port", "Outdoor", "Enterprise", "30m", "Dual-Band"]],
    ["Printing", "Printers, toner and consumables", [45, 6200],
        ["Laser Printer", "Toner Cartridge", "Ink Cartridge", "Label Printer", "Photo Paper", "Drum Unit", "Multifunction Printer", "Thermal Rolls", "Laminator", "Scanner"],
        ["Black", "Color", "High Yield", "A3", "Wireless", "Duplex"]],
    ["Cleaning", "Janitorial and hygiene products", [12, 950],
        ["Hand Sanitizer", "Floor Cleaner", "Paper Towels", "Trash Bags", "Disinfectant Spray", "Microfiber Cloths", "Mop Set", "Soap Dispenser", "Toilet Paper", "Glass Cleaner"],
        ["5L", "1L", "Pack of 12", "Industrial", "Unscented", "Refill"]],
    ["Packaging", "Boxes, tape and shipping materials", [8, 680],
        ["Cardboard Box", "Packing Tape", "Bubble Wrap", "Stretch Film", "Pallet Wrap", "Shipping Labels", "Mailer Bags", "Void Fill", "Strapping Kit", "Corner Protectors"],
        ["Small", "Medium", "Large", "Heavy Duty", "Roll", "Pack of 100"]],
    ["Safety Equipment", "PPE and workplace safety", [25, 2400],
        ["Safety Helmet", "Hi-Vis Vest", "Work Gloves", "Safety Goggles", "First Aid Kit", "Fire Extinguisher", "Safety Boots", "Ear Defenders", "Dust Masks", "Warning Signs"],
        ["Size M", "Size L", "Class 2", "Pack of 10", "Industrial", "EN Certified"]],
    ["Kitchen & Breakroom", "Coffee, snacks and appliances", [15, 5200],
        ["Coffee Beans", "Espresso Machine", "Mint Tea", "Water Dispenser", "Microwave", "Mugs Set", "Sugar Sticks", "Paper Cups", "Kettle", "Mini Fridge"],
        ["1kg", "Pack of 50", "Arabica", "Stainless", "Pack of 6", "Compact"]],
    ["Lighting", "Lamps, bulbs and fixtures", [20, 1800],
        ["LED Panel", "Desk Lamp", "LED Bulb", "Floodlight", "Emergency Light", "Track Light", "Ceiling Fixture", "Light Strip", "Motion Sensor Light", "Downlight"],
        ["Warm White", "Daylight", "40W", "Dimmable", "Pack of 4", "Outdoor"]],
    ["Tools & Hardware", "Hand tools, power tools and fixings", [18, 3600],
        ["Cordless Drill", "Screwdriver Set", "Tool Box", "Measuring Tape", "Spirit Level", "Wall Anchors", "Hammer", "Utility Knife", "Socket Set", "Ladder"],
        ["18V", "Pro", "Pack of 100", "5m", "Steel", "Compact"]],
    ["Software & Licenses", "Business software subscriptions", [150, 12000],
        ["Office Suite License", "Antivirus License", "Accounting Software", "Backup Service", "Design Suite", "Project Management Plan", "VPN Subscription", "CRM Seats", "Email Hosting", "Cloud Storage"],
        ["1 Year", "5 Users", "10 Users", "Business", "Enterprise", "Starter"]],
    ["Storage & Archiving", "Shelving, boxes and archive solutions", [25, 3900],
        ["Archive Box", "Metal Shelving", "Document Wallet", "Lever Arch File", "Plastic Crate", "Mobile Pedestal", "Key Cabinet", "Safe Box", "Magazine File", "Suspension Files"],
        ["A4", "Pack of 10", "5-Tier", "Lockable", "Heavy Duty", "Transparent"]],
    ["Textiles & Uniforms", "Workwear and branded apparel", [40, 900],
        ["Polo Shirt", "Work Jacket", "Apron", "Cargo Trousers", "Fleece", "Cap", "Overalls", "Lab Coat", "T-Shirt", "Rain Jacket"],
        ["Navy", "Black", "Embroidered", "Size L", "Size XL", "Pack of 5"]]
];

/** mulberry32: small, fast, seedable PRNG. */
function createRandom(seed) {
    let state = seed >>> 0;

    const next = () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const int = (min, max) => Math.floor(next() * (max - min + 1)) + min;
    const pick = (items) => items[Math.floor(next() * items.length)];
    const chance = (probability) => next() < probability;

    function weighted(entries) {
        const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
        let roll = next() * total;
        for (const [value, weight] of entries) {
            roll -= weight;
            if (roll <= 0) return value;
        }
        return entries[entries.length - 1][0];
    }

    return { next, int, pick, chance, weighted };
}

/** Builds a sampler that returns indexes with Pareto-like popularity. */
// Demand patterns for the forecasting model to learn. Monthly multipliers
// (January first) per category; categories not listed sell evenly all year.
const SEASONALITY = {
    "Office Supplies": [1.0, 0.95, 0.9, 0.9, 0.85, 0.8, 0.55, 0.65, 1.9, 1.3, 1.0, 0.9], // back to school
    Electronics: [0.8, 0.75, 0.85, 0.9, 0.9, 0.85, 0.8, 0.75, 1.0, 1.1, 1.5, 1.8], // year-end budgets
    "Software & Licenses": [1.9, 0.85, 0.8, 0.8, 0.8, 0.8, 0.7, 0.6, 0.9, 0.9, 1.0, 1.4], // annual renewals
    Furniture: [1.2, 1.0, 0.9, 0.9, 0.8, 0.8, 0.6, 1.3, 1.5, 1.0, 0.9, 0.8], // office moves before September
    Packaging: [0.9, 0.9, 1.0, 1.0, 1.0, 1.0, 0.9, 0.9, 1.0, 1.1, 1.5, 1.6], // year-end shipping
    Cleaning: [1.1, 1.0, 1.3, 1.4, 1.0, 0.9, 0.8, 0.7, 1.2, 1.0, 1.0, 1.0], // spring cleaning
    "Safety Equipment": [0.9, 0.9, 1.1, 1.2, 1.3, 1.3, 1.1, 1.0, 1.0, 1.0, 0.9, 0.8], // construction season
    "Kitchen & Breakroom": [1.0, 1.0, 1.2, 1.3, 1.0, 0.9, 0.8, 0.8, 1.0, 1.0, 1.0, 1.4]
};

// Fewer orders overall in the summer holidays.
const MONTH_VOLUME = [1.0, 1.0, 1.05, 1.0, 1.0, 0.95, 0.85, 0.7, 1.1, 1.05, 1.05, 1.0];
const MAX_DEMAND_FACTOR = 1.9 * 1.9;

/** How much a product sells at a point in time, relative to its usual level. */
function demandFactor(product, date, position) {
    const season = SEASONALITY[CATALOG[product.categoryIndex % CATALOG.length][0]]?.[date.getMonth()] ?? 1;
    const trend = Math.max(0.15, 1 + product.trend * (position - 0.5) * 2);
    return season * trend;
}

function popularitySampler(random, count, skew = 1.1) {
    const weights = Array.from({ length: count }, (_, index) => 1 / (index + 1) ** skew);
    const cumulative = [];
    let total = 0;
    for (const weight of weights) {
        total += weight;
        cumulative.push(total);
    }

    // Shuffle so popularity isn't tied to insertion order.
    const order = Array.from({ length: count }, (_, index) => index);
    for (let i = count - 1; i > 0; i -= 1) {
        const j = Math.floor(random.next() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }

    return () => {
        const roll = random.next() * total;
        let low = 0;
        let high = cumulative.length - 1;
        while (low < high) {
            const mid = (low + high) >> 1;
            if (cumulative[mid] < roll) low = mid + 1;
            else high = mid;
        }
        return order[low];
    };
}

function slug(text) {
    return text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
}

function round2(value) {
    return Math.round(value * 100) / 100;
}

/** Status distribution depends on how old the order is. */
function statusForAge(random, ageDays) {
    if (ageDays < 3) return random.weighted([["Pending", 60], ["Processing", 30], ["Cancelled", 10]]);
    if (ageDays < 14) return random.weighted([["Pending", 15], ["Processing", 45], ["Completed", 30], ["Cancelled", 10]]);
    if (ageDays < 30) return random.weighted([["Processing", 10], ["Completed", 80], ["Cancelled", 10]]);
    return random.weighted([["Completed", 90], ["Cancelled", 10]]);
}

function generateCategories() {
    return CATALOG.map(([name, description]) => ({ name, description }));
}

function generateCustomers(random, count, { now, earliest }) {
    const usedCompanies = new Set();
    const customers = [];

    for (let index = 0; index < count; index += 1) {
        let company;
        do {
            const form = random.pick(LEGAL_FORMS);
            company = `${random.pick(COMPANY_PREFIXES)} ${random.pick(COMPANY_TYPES)}${form ? ` ${form}` : ""}`;
            if (usedCompanies.has(company)) company = `${company} ${random.int(2, 99)}`;
        } while (usedCompanies.has(company));
        usedCompanies.add(company);

        const first = random.pick(FIRST_NAMES);
        const last = random.pick(LAST_NAMES);
        const foreign = random.chance(0.08);
        const [city, country] = foreign ? random.pick(FOREIGN) : [random.weighted(CITIES), "Morocco"];

        customers.push({
            company_name: company,
            contact_name: `${first} ${last}`,
            email: `${slug(first)}.${slug(last)}${index}@${slug(company).slice(0, 18)}.example.com`,
            phone: foreign
                ? `+${random.int(30, 49)} ${random.int(100, 999)} ${random.int(100, 999)} ${random.int(100, 999)}`
                : `+212 6${random.int(10, 99)} ${random.int(10, 99)} ${random.int(10, 99)} ${random.int(10, 99)}`,
            address: `${random.int(1, 240)} ${random.pick(STREETS)}`,
            city,
            country,
            created_at: new Date(earliest.getTime() + random.next() * (now.getTime() - earliest.getTime()))
        });
    }

    return customers;
}

function generateProducts(random, count, categoryCount) {
    const products = [];
    const usedNames = new Set();

    for (let index = 0; index < count; index += 1) {
        const categoryIndex = index % categoryCount;
        const [, , [minPrice, maxPrice], names, variants] = CATALOG[categoryIndex % CATALOG.length];

        let name;
        let base;
        let attempts = 0;
        do {
            base = random.pick(names);
            name = `${base} ${random.pick(variants)}`;
            attempts += 1;
            if (attempts > 20) name = `${name} #${index}`;
        } while (usedNames.has(name));
        usedNames.add(name);

        // Skew prices toward the low end of the range.
        const price = round2(minPrice + (maxPrice - minPrice) * random.next() ** 2.2);

        // Mostly healthy stock, with some low and out-of-stock items for alerts.
        const stockBand = random.weighted([["healthy", 84], ["low", 11], ["out", 5]]);
        const stock = stockBand === "out" ? 0 : stockBand === "low" ? random.int(1, 5) : random.int(12, 480);

        products.push({
            categoryIndex,
            base,
            name,
            description: `${name} — ${CATALOG[categoryIndex % CATALOG.length][1].toLowerCase()}.`,
            price,
            stock,
            is_active: random.chance(0.94) ? 1 : 0,
            // Growing, declining or steady over the generated period.
            trend: random.weighted([[0, 50], [1, 25], [-1, 25]]) * (0.3 + 0.6 * random.next())
        });
    }

    return products;
}

/** Picks an order timestamp with business growth and a weekday bias. */
function orderDate(random, start, now) {
    const span = now.getTime() - start.getTime();
    for (;;) {
        const position = random.next();
        const date = new Date(start.getTime() + position * span);
        const growth = 0.45 + 0.55 * position;
        const day = date.getDay();
        const weekday = day === 0 ? 0.25 : day === 6 ? 0.55 : 1;
        if (random.next() < (growth * weekday * MONTH_VOLUME[date.getMonth()]) / 1.1) {
            date.setHours(random.int(8, 18), random.int(0, 59), random.int(0, 59), 0);
            return date > now ? now : date;
        }
    }
}

// What each kind of business buys. Weights per category; every other category
// gets BASE_AFFINITY, so customers still buy a little of everything.
const SEGMENTS = [
    ["office", 30, { "Office Supplies": 5, Printing: 3, Furniture: 2, "Kitchen & Breakroom": 2, "Storage & Archiving": 2.5, "Software & Licenses": 1.5, Electronics: 1.5 }],
    ["tech", 20, { Electronics: 5, Networking: 4.5, "Software & Licenses": 4, Printing: 1.5, "Office Supplies": 1.5 }],
    ["logistics", 20, { Packaging: 5, "Safety Equipment": 4, "Tools & Hardware": 2.5, "Storage & Archiving": 2, Cleaning: 2, "Textiles & Uniforms": 2 }],
    ["hospitality", 15, { "Kitchen & Breakroom": 5, Cleaning: 4.5, "Textiles & Uniforms": 2.5, Lighting: 1.5, Furniture: 1.5 }],
    ["facilities", 15, { "Tools & Hardware": 5, "Safety Equipment": 3.5, Lighting: 4, Cleaning: 2.5, "Textiles & Uniforms": 1.5 }]
];
const BASE_AFFINITY = 0.25;
const MAX_AFFINITY = 5;
const REPEAT_CHANCE = 0.45; // a line is a reorder of something the customer already buys
const COMPLEMENT_LATER = 0.6; // after buying equipment, its consumables are likely to follow
const COMPLEMENT_SAME_ORDER = 0.25;

// Bought together, or one after the other: equipment and what it uses.
const COMPLEMENTS = {
    "Laser Printer": ["Toner Cartridge", "Drum Unit"],
    "Multifunction Printer": ["Toner Cartridge", "A4 Paper Pack"],
    "Label Printer": ["Shipping Labels", "Thermal Rolls"],
    "Espresso Machine": ["Coffee Beans", "Sugar Sticks", "Paper Cups"],
    "Water Dispenser": ["Paper Cups"],
    "Kettle": ["Mint Tea", "Mugs Set"],
    "Cordless Drill": ["Wall Anchors", "Screwdriver Set"],
    "Network Rack": ["Patch Panel", "Cat6 Cable"],
    "Gigabit Switch": ["Cat6 Cable", "Patch Panel"],
    "Access Point": ["PoE Injector", "Cat6 Cable"],
    "Standing Desk": ["Ergonomic Chair", "Laptop Stand"],
    "Workstation": ["Ergonomic Chair", "Desk Lamp"],
    "Docking Station": ["27\" Monitor", "Wireless Mouse"],
    "Metal Shelving": ["Archive Box", "Plastic Crate"],
    "Soap Dispenser": ["Hand Sanitizer", "Paper Towels"],
    "Mop Set": ["Floor Cleaner", "Microfiber Cloths"],
    "Pallet Wrap": ["Strapping Kit", "Corner Protectors"],
    "Cardboard Box": ["Packing Tape", "Void Fill"],
    "Safety Helmet": ["Hi-Vis Vest", "Safety Goggles"],
    "Safety Boots": ["Hi-Vis Vest", "Work Gloves"]
};

/** A customer's line of business and buying preferences, the same every time for the same key. */
function buyerProfile(customerKey) {
    const random = createRandom(31337 + Number(customerKey) * 104729);
    const [segment, , weights] = random.weighted(SEGMENTS.map((entry) => [entry, entry[1]]));
    const affinity = Object.fromEntries(CATALOG.map(([category]) => [category, weights[category] ?? BASE_AFFINITY]));
    // Plus one side interest outside their main line.
    const extra = random.pick(CATALOG)[0];
    affinity[extra] = Math.max(affinity[extra], 2.5);
    return { segment, affinity };
}

function generateOrders(random, count, { customers, products, now, months }) {
    const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    const pickCustomer = popularitySampler(random, customers.length, 0.9);
    const pickProduct = popularitySampler(random, products.length, 1.05);
    const categoryOf = (product) => CATALOG[product.categoryIndex % CATALOG.length][0];

    const byBase = new Map();
    products.forEach((product, index) => {
        if (!byBase.has(product.base)) byBase.set(product.base, []);
        byBase.get(product.base).push(index);
    });
    const complementOf = (productIndex) => {
        const bases = (COMPLEMENTS[products[productIndex].base] ?? []).filter((base) => byBase.has(base));
        return bases.length ? random.pick(byBase.get(random.pick(bases))) : null;
    };

    // Orders are generated in date order so each one can build on the customer's history.
    const dates = Array.from({ length: count }, () => orderDate(random, start, now)).sort((a, b) => a - b);
    const history = new Map(); // customer index → { bought: Map(product index → times), pending: product indexes }
    const orders = [];

    for (const created of dates) {
        const customerIndex = pickCustomer();
        const { affinity } = buyerProfile(customerIndex);
        if (!history.has(customerIndex)) history.set(customerIndex, { bought: new Map(), pending: [] });
        const state = history.get(customerIndex);

        const ageDays = (now.getTime() - created.getTime()) / 86400000;
        const position = (created.getTime() - start.getTime()) / (now.getTime() - start.getTime());
        const inSeason = (index) => random.next() * MAX_DEMAND_FACTOR < demandFactor(products[index], created, position);

        // Reorders, then consumables for equipment bought earlier, then new products
        // from the categories this kind of business uses. Seasonality and trend
        // decide whether the candidate is bought.
        const pickLine = () => {
            for (let tries = 0; tries < 60; tries += 1) {
                let candidate;
                if (state.bought.size && random.chance(REPEAT_CHANCE)) {
                    candidate = random.weighted([...state.bought.entries()]);
                } else if (state.pending.length && random.chance(0.3)) {
                    candidate = state.pending.splice(random.int(0, state.pending.length - 1), 1)[0];
                } else {
                    candidate = pickProduct();
                    if (random.next() * MAX_AFFINITY >= affinity[categoryOf(products[candidate])]) continue;
                }
                if (inSeason(candidate)) return candidate;
            }
            return pickProduct();
        };

        const lineCount = random.weighted([[1, 30], [2, 30], [3, 20], [4, 12], [5, 8]]);
        const productIndexes = new Set();
        let guard = 0;
        while (productIndexes.size < lineCount && guard < 50) {
            productIndexes.add(pickLine());
            guard += 1;
        }
        for (const productIndex of [...productIndexes]) {
            if (productIndexes.size < 6 && random.chance(COMPLEMENT_SAME_ORDER)) {
                const complement = complementOf(productIndex);
                if (complement !== null) productIndexes.add(complement);
            }
        }

        for (const productIndex of productIndexes) {
            state.bought.set(productIndex, (state.bought.get(productIndex) ?? 0) + 1);
            if (random.chance(COMPLEMENT_LATER)) {
                const complement = complementOf(productIndex);
                if (complement !== null && !state.bought.has(complement)) state.pending.push(complement);
            }
        }

        const items = [...productIndexes].map((productIndex) => {
            const product = products[productIndex];
            // Cheaper goods are ordered in larger quantities.
            const maxQuantity = product.price < 50 ? 60 : product.price < 300 ? 20 : product.price < 1500 ? 8 : 3;
            return {
                productIndex,
                quantity: random.int(1, maxQuantity),
                unit_price: product.price
            };
        });

        orders.push({
            customerIndex,
            status: statusForAge(random, ageDays),
            created_at: created,
            items,
            total_amount: round2(items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0))
        });
    }

    // A customer can't order before they existed.
    for (const order of orders) {
        const customer = customers[order.customerIndex];
        if (customer.created_at > order.created_at) {
            customer.created_at = new Date(order.created_at.getTime() - random.int(1, 60) * 86400000);
        }
    }

    return orders;
}

function generateUsers(random, count) {
    const users = [];
    const roles = [["Manager", 3], ["Accountant", 1], ["Warehouse", 2], ["Employee", 4]];

    for (let index = 0; index < count; index += 1) {
        const first = random.pick(FIRST_NAMES);
        const last = random.pick(LAST_NAMES);
        users.push({
            first_name: first,
            last_name: last,
            email: `${slug(first)}.${slug(last)}${index}@seed.b2b.local`,
            // Seeded accounts never get Admin rights.
            role: index === 0 ? "Manager" : random.weighted(roles),
            is_active: random.chance(0.9) ? 1 : 0
        });
    }

    return users;
}

const DAY_MS = 86400000;

function paymentReference(random, method, date) {
    const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    if (method === "Bank transfer") return `VIR-${ymd}-${random.int(1000, 9999)}`;
    if (method === "Cheque") return `CHQ-${random.int(100000, 999999)}`;
    if (method === "Card") return `CB-****${random.int(1000, 9999)}`;
    return null;
}

// How each customer pays. Habits belong to the customer, not to the invoice:
// some always pay early, some are always a few weeks late, a few are
// unpredictable, and some slowly get worse (or better) over time. The
// late-payment model in ml/ has to find these patterns from history alone.
const PAYER_TYPES = [
    // [name, weight, mean days after the due date, spread in days, chance of never paying]
    ["early", 30, -9, 8, 0.001],
    ["on_time", 35, -3, 9, 0.002],
    ["slow", 25, 10, 13, 0.006],
    ["erratic", 10, 5, 24, 0.015]
];
const MAX_DRIFT_DAYS = 25;
// Any invoice can get stuck: a dispute, a lost invoice, a missing purchase order number.
const DISPUTE_CHANCE = 0.07;

/** A customer's payment habits, the same every time for the same customer key. */
function payerProfile(customerKey) {
    const random = createRandom(90210 + Number(customerKey) * 7919);
    const [type, , mean, spread, neverPays] = random.weighted(PAYER_TYPES.map((entry) => [entry, entry[1]]));
    // About one customer in six drifts: days later (or earlier) per year.
    const drift = random.chance(0.17) ? random.weighted([[1, 70], [-1, 30]]) * (12 + random.next() * 18) : 0;
    return { type, mean, spread, neverPays, drift };
}

/** Roughly normal noise (sum of uniforms), mean 0, standard deviation ~1. */
function gaussian(random) {
    return random.next() + random.next() + random.next() + random.next() - 2;
}

/**
 * Realistic payment history for orders. Each input order needs status,
 * total_amount (HT), created_at, and customer_key (any stable id of the
 * customer); `key` is passed through to identify it.
 *
 * Each invoice is paid around the customer's usual delay, later for large
 * invoices and in August and December, earlier for small ones. Payments that
 * would fall after `now` haven't happened yet, so recent invoices stay open
 * and chronic late payers build up overdue balances.
 */
function generatePayments(random, orders, now = new Date()) {
    const payments = [];
    const origin = new Date(2024, 0, 1).getTime();

    for (const order of orders) {
        if (order.status === "Cancelled") continue;

        const profile = payerProfile(order.customer_key ?? 0);
        const created = new Date(order.created_at);
        const { total } = invoiceTotals(order.total_amount);
        const due = new Date(created.getTime() + PAYMENT_TERMS_DAYS * DAY_MS);

        if (random.chance(profile.neverPays)) continue;

        const yearsIn = (created.getTime() - origin) / (365 * DAY_MS);
        const sizeEffect = Math.max(-4, Math.min(10, 4 * Math.log2(Math.max(total, 100) / 10000)));
        const month = created.getMonth();
        const seasonEffect = month === 7 || month === 11 ? 7 : 0; // August holidays, year-end closing
        const disputeDelay = random.chance(DISPUTE_CHANCE) ? random.int(15, 60) : 0;
        const driftEffect = Math.max(-MAX_DRIFT_DAYS, Math.min(MAX_DRIFT_DAYS, profile.drift * yearsIn));
        // Reminders, calls, then a stop on deliveries: almost everyone pays within ~2-3 months of the due date.
        const collectedBy = 60 + random.int(0, 30);
        const delayDays = Math.min(
            collectedBy,
            profile.mean + driftEffect + sizeEffect + seasonEffect + disputeDelay + gaussian(random) * profile.spread
        );

        const finalDate = Math.max(created.getTime() + DAY_MS, due.getTime() + delayDays * DAY_MS);

        // Big invoices are sometimes paid in two parts, the first one earlier.
        const installments = total > 5000 && random.chance(0.25);
        let plan = [[total, finalDate]];
        if (installments) {
            const first = roundMoney(total * (0.4 + random.next() * 0.2));
            const firstDate = created.getTime() + (finalDate - created.getTime()) * (0.3 + random.next() * 0.4);
            plan = [[first, firstDate], [roundMoney(total - first), finalDate]];
        }

        plan.forEach(([amount, time], index) => {
            if (amount <= 0 || time > now.getTime()) return;
            const paidAt = new Date(time);
            const method = random.weighted([["Bank transfer", 68], ["Cheque", 16], ["Card", 10], ["Cash", 6]]);
            payments.push({
                key: order.key,
                amount,
                method,
                reference: paymentReference(random, method, paidAt),
                paid_at: paidAt,
                note: plan.length > 1 ? `Installment ${index + 1} of ${plan.length}` : null
            });
        });
    }

    return payments;
}

function generateDataset({ seed = 2026, customers = 400, products = 350, orders = 5000, users = 24, months = 24, now = new Date() } = {}) {
    const random = createRandom(seed);
    const earliest = new Date(now.getFullYear(), now.getMonth() - months - 6, 1);

    const categoryList = generateCategories();
    const customerList = generateCustomers(random, customers, { now, earliest });
    const productList = generateProducts(random, products, categoryList.length);
    const orderList = generateOrders(random, orders, { customers: customerList, products: productList, now, months });
    const userList = generateUsers(random, users);
    const paymentList = generatePayments(
        random,
        orderList.map((order, index) => ({ ...order, key: index, customer_key: order.customerIndex })),
        now
    );

    return {
        categories: categoryList,
        customers: customerList,
        products: productList,
        orders: orderList,
        users: userList,
        payments: paymentList
    };
}

module.exports = {
    STATUSES,
    createRandom,
    generateDataset,
    buyerProfile,
    generatePayments,
    payerProfile
};
