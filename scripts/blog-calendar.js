// Relokates Weekly Blog Calendar
const CALENDAR = [
  {
    "week": 1,
    "title": "How to move house in London \u2014 the complete guide for 2026",
    "slug": "how-to-move-house-in-london-complete-guide",
    "category": "Moving Tips",
    "keywords": [
      "move house London",
      "house removal London",
      "moving guide London 2026"
    ],
    "caption": "Moving house in London in 2026? Everything you need to know \u2014 from parking suspensions to the best time to move. Our complete guide is live now. Link in bio \ud83d\udc47\n\n#LondonRemovals #MovingLondon #HouseMove #RelokatesRemovals #MovingTips #London #RemovalCompany #FullyInsured"
  },
  {
    "week": 2,
    "title": "Moving from London to Essex \u2014 what nobody tells you",
    "slug": "moving-london-to-essex-what-nobody-tells-you",
    "category": "Area Guide",
    "keywords": [
      "moving London to Essex",
      "London Essex relocation",
      "move to Essex from London"
    ],
    "caption": "Made the move from London to Essex \u2014 or thinking about it? Here is the honest picture from a removal company that does this route every week. Link in bio \ud83d\udc47\n\n#LondonToEssex #EssexRemovals #MovingToEssex #RelokatesRemovals #HouseMove #Essex #RemovalCompany"
  },
  {
    "week": 3,
    "title": "The complete guide to London parking suspensions for removals",
    "slug": "london-parking-suspensions-removals-complete-guide",
    "category": "London Removals",
    "keywords": [
      "parking suspension London removal",
      "CPZ parking London",
      "removal van parking London"
    ],
    "caption": "Did you know your removal van cannot legally park in most London streets without a parking suspension? Here is everything you need to know before moving day. Link in bio \ud83d\udc47\n\n#LondonRemovals #ParkingLondon #RemovalTips #RelokatesRemovals #MovingLondon #HouseMove"
  },
  {
    "week": 4,
    "title": "How to move house with a cat or dog \u2014 the stress-free guide",
    "slug": "moving-house-with-pets-cats-dogs-guide",
    "category": "Moving Tips",
    "keywords": [
      "moving house with pets",
      "moving with a dog",
      "moving with a cat",
      "pets moving house UK"
    ],
    "caption": "Moving house with a dog or cat? Here is how to keep them calm, safe and settled \u2014 before, during and after moving day. Link in bio \ud83d\udc47\n\n#MovingWithPets #PetFriendly #MovingTips #RelokatesRemovals #HouseMove #CatsOfInstagram #DogsOfInstagram"
  },
  {
    "week": 5,
    "title": "Moving to Kent from London \u2014 the honest five year review",
    "slug": "moving-to-kent-from-london-honest-review",
    "category": "Area Guide",
    "keywords": [
      "moving to Kent from London",
      "London to Kent move",
      "Kent relocation guide"
    ],
    "caption": "Thousands of Londoners have made the move to Kent. Five years on \u2014 what do they actually think? We asked our clients. The honest answer is here. Link in bio \ud83d\udc47\n\n#LondonToKent #KentRemovals #MovingToKent #RelokatesRemovals #KentLife #HouseMove"
  },
  {
    "week": 6,
    "title": "What to expect from a professional packing service \u2014 is it worth it?",
    "slug": "professional-packing-service-is-it-worth-it",
    "category": "Packing",
    "keywords": [
      "professional packing service",
      "packing service removal",
      "is packing service worth it"
    ],
    "caption": "Is a professional packing service actually worth the cost? We break down what you get, what it costs and when it makes sense. Link in bio \ud83d\udc47\n\n#PackingService #MovingTips #RelokatesRemovals #HouseMove #Packing #RemovalCompany #FullyInsured"
  },
  {
    "week": 7,
    "title": "How to move a grand piano \u2014 everything you need to know",
    "slug": "how-to-move-grand-piano-complete-guide",
    "category": "Specialist Removals",
    "keywords": [
      "move grand piano",
      "piano removal",
      "moving a piano UK",
      "grand piano removal London"
    ],
    "caption": "Moving a grand piano is not a job for a standard removal company. Here is exactly what specialist piano removal involves \u2014 and what to ask before you book. Link in bio \ud83d\udc47\n\n#PianoRemoval #GrandPiano #SpecialistRemovals #RelokatesRemovals #LuxuryRemovals #MovingTips"
  },
  {
    "week": 8,
    "title": "Moving to West Sussex from London \u2014 the complete relocation guide",
    "slug": "moving-to-west-sussex-from-london-guide",
    "category": "Area Guide",
    "keywords": [
      "moving to West Sussex",
      "London to West Sussex",
      "relocate to West Sussex from London"
    ],
    "caption": "Brighton, Worthing, Horsham, Chichester \u2014 West Sussex is attracting London buyers in record numbers. Here is everything you need to know before you make the move. Link in bio \ud83d\udc47\n\n#MovingToSussex #WestSussexRemovals #LondonToSussex #RelokatesRemovals #BrightonLife #HouseMove"
  },
  {
    "week": 9,
    "title": "How to prepare your home for sale before a house move",
    "slug": "how-to-prepare-home-for-sale-before-moving",
    "category": "Moving Tips",
    "keywords": [
      "prepare home for sale",
      "house move preparation",
      "selling and moving house tips"
    ],
    "caption": "Preparing your home for sale while planning a move at the same time? Here is the practical guide to doing both without losing your mind. Link in bio \ud83d\udc47\n\n#HomeSale #MovingTips #HouseMove #RelokatesRemovals #PropertyTips #SellingYourHome"
  },
  {
    "week": 10,
    "title": "Office removals in London \u2014 how to move with zero downtime",
    "slug": "office-removals-london-zero-downtime-guide",
    "category": "Office Removals",
    "keywords": [
      "office removals London",
      "commercial relocation London",
      "office move zero downtime"
    ],
    "caption": "Moving your London office without losing a working day is possible \u2014 if you plan it right. Here is the complete guide to a zero-downtime office relocation. Link in bio \ud83d\udc47\n\n#OfficeRemovals #CommercialRemovals #LondonBusiness #RelokatesRemovals #OfficeMove #BusinessRemovals"
  },
  {
    "week": 11,
    "title": "Moving to Dubai from London \u2014 the ultimate relocation checklist",
    "slug": "moving-to-dubai-from-london-ultimate-checklist",
    "category": "International",
    "keywords": [
      "moving to Dubai from London",
      "London to Dubai removal",
      "Dubai relocation checklist UK"
    ],
    "caption": "Moving from London to Dubai? This is the complete checklist \u2014 visas, customs, shipping, schools and everything in between. Link in bio \ud83d\udc47\n\n#MovingToDubai #DubaiRemovals #LondonToDubai #InternationalRemovals #RelokatesRemovals #DubaiLife #Expat"
  },
  {
    "week": 12,
    "title": "How much does a house removal cost in London in 2026?",
    "slug": "house-removal-cost-london-2026",
    "category": "Cost Guide",
    "keywords": [
      "house removal cost London",
      "removal prices London 2026",
      "how much does removal cost London"
    ],
    "caption": "What does a house removal in London actually cost in 2026? Honest pricing by property size \u2014 no hidden extras, no vague ranges. Real numbers. Link in bio \ud83d\udc47\n\n#RemovalCosts #LondonRemovals #HouseMove #RelokatesRemovals #MovingCosts #FixedPrice"
  },
  {
    "week": 13,
    "title": "Moving house with a newborn \u2014 the practical guide",
    "slug": "moving-house-with-newborn-practical-guide",
    "category": "Moving Tips",
    "keywords": [
      "moving house with baby",
      "moving with newborn",
      "house move with infant"
    ],
    "caption": "Moving house with a newborn or young baby is one of the hardest things you can do. Here is the practical guide \u2014 timing, routine, safety and settling in. Link in bio \ud83d\udc47\n\n#MovingWithBaby #NewHome #MovingTips #RelokatesRemovals #HouseMove #NewParents #BabyLife"
  },
  {
    "week": 14,
    "title": "The truth about man and van services \u2014 what to check before you book",
    "slug": "truth-about-man-and-van-what-to-check",
    "category": "Man and Van",
    "keywords": [
      "man and van London",
      "man and van Essex",
      "man and van insured",
      "best man and van"
    ],
    "caption": "Not all man and van services are the same. Here is what to check before you book \u2014 and the red flags that should make you walk away. Link in bio \ud83d\udc47\n\n#ManAndVan #LondonRemovals #MovingTips #RelokatesRemovals #HouseMove #InsuredRemovals"
  },
  {
    "week": 15,
    "title": "How to move house when you are in a chain \u2014 managing the uncertainty",
    "slug": "moving-house-in-a-chain-managing-uncertainty",
    "category": "Moving Tips",
    "keywords": [
      "property chain house move",
      "moving in a chain UK",
      "property chain completion"
    ],
    "caption": "In a property chain? Here is how to protect yourself, manage the uncertainty and still get moved \u2014 even when things do not go to plan. Link in bio \ud83d\udc47\n\n#PropertyChain #HouseMove #MovingTips #RelokatesRemovals #UKProperty #Completion"
  },
  {
    "week": 16,
    "title": "Moving fine art and antiques \u2014 the specialist guide",
    "slug": "moving-fine-art-antiques-specialist-guide",
    "category": "Luxury Removals",
    "keywords": [
      "moving fine art",
      "antique furniture removal",
      "art removal London",
      "specialist removals antiques"
    ],
    "caption": "Fine art, antiques and high-value furniture require a very different approach to standard removal. Here is what specialist handling actually involves. Link in bio \ud83d\udc47\n\n#FineArt #AntiqueRemoval #LuxuryRemovals #RelokatesRemovals #SpecialistRemovals #ArtCollection"
  },
  {
    "week": 17,
    "title": "Moving house in Essex \u2014 the complete county guide",
    "slug": "moving-house-in-essex-complete-guide",
    "category": "Area Guide",
    "keywords": [
      "moving house Essex",
      "Essex removals guide",
      "house move Essex towns"
    ],
    "caption": "Moving within Essex or relocating to the county? Here is the complete guide \u2014 from the A12 corridor to the coast, from Chelmsford to Colchester. Link in bio \ud83d\udc47\n\n#EssexRemovals #MovingEssex #RelokatesRemovals #HouseMove #Essex #Chelmsford #Colchester"
  },
  {
    "week": 18,
    "title": "How to declutter before a house move \u2014 room by room guide",
    "slug": "how-to-declutter-before-house-move-room-by-room",
    "category": "Packing",
    "keywords": [
      "declutter before moving",
      "how to declutter before move",
      "declutter house move guide"
    ],
    "caption": "The room-by-room decluttering guide before your house move. Start here \u2014 8 weeks out \u2014 and moving day will be dramatically less stressful. Link in bio \ud83d\udc47\n\n#Declutter #MovingTips #HouseMove #RelokatesRemovals #DeclutterYourHome #MinimalistLiving"
  },
  {
    "week": 19,
    "title": "Storage during a house move \u2014 when you need it and how it works",
    "slug": "storage-during-house-move-when-and-how",
    "category": "Storage",
    "keywords": [
      "storage during house move",
      "removal and storage",
      "completion gap storage UK"
    ],
    "caption": "Completion gap? Renovation in progress? Downsizing? Here is exactly when you need storage during a house move and how the process works. Link in bio \ud83d\udc47\n\n#StorageSolutions #HouseMove #MovingTips #RelokatesRemovals #SecureStorage #PropertyMove"
  },
  {
    "week": 20,
    "title": "Moving to Sevenoaks from London \u2014 the honest guide",
    "slug": "moving-to-sevenoaks-from-london-honest-guide",
    "category": "Area Guide",
    "keywords": [
      "moving to Sevenoaks",
      "Sevenoaks from London",
      "relocate to Sevenoaks Kent"
    ],
    "caption": "Sevenoaks keeps topping the best places to live lists. But is it right for you? Here is the honest guide from a removal company that moves people there every week. Link in bio \ud83d\udc47\n\n#MovingToSevenoaks #SevenoaksLife #KentRemovals #RelokatesRemovals #LondonToKent #HouseMove"
  }
];
module.exports = CALENDAR;
