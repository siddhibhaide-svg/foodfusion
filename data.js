/* =========================================================
   FOODFUSION SEED DATA
   - These dishes are copied into the browser (localStorage)
     the first time the site opens. After that the Admin page
     edits the browser copy, not this file.
   - "wiki" = the Wikipedia article whose photo is shown for
     the dish (loaded live, then cached).
========================================================= */

const CUISINES = {
  Indian:   { emoji: "🍛", line: "Spicy & traditional", wiki: "Biryani",    blurb: "Slow-cooked gravies, smoky tandoor and street-food classics." },
  Italian:  { emoji: "🍝", line: "Pizza & pasta",       wiki: "Pizza",      blurb: "Wood-fired pizzas, fresh pasta and rich, creamy comfort food." },
  Korean:   { emoji: "🍲", line: "Bold & flavourful",   wiki: "Bibimbap",   blurb: "Fermented, fiery and deeply savoury, from bibimbap to fried chicken." },
  Japanese: { emoji: "🍣", line: "Fresh & delicate",    wiki: "Ramen",      blurb: "Clean flavours, perfect rice and noodles slurped hot." },
  Chinese:  { emoji: "🥡", line: "Rich & aromatic",     wiki: "Dim sum",    blurb: "Wok-tossed, steamed and sizzling favourites." },
  Mexican:  { emoji: "🌮", line: "Spicy & exciting",    wiki: "Taco",       blurb: "Tacos, burritos and crunchy snacks with a zesty kick." }
};

const CATEGORIES = ["Starter", "Main course", "Rice & Noodles", "Snack", "Soup", "Dessert"];

// [name, cuisine, category, price, rating, veg(1/0), wikipedia title, description, badge]
const RAW = [
  ["Butter Chicken","Indian","Main course",279,4.7,0,"Butter chicken","Tender chicken in a creamy tomato-butter gravy.","🏆 Best seller"],
  ["Paneer Tikka","Indian","Starter",229,4.5,1,"Paneer tikka","Char-grilled cottage cheese with mint chutney.",""],
  ["Chicken Biryani","Indian","Rice & Noodles",299,4.8,0,"Biryani","Layered basmati rice, saffron and slow-cooked chicken.","🔥 Trending"],
  ["Masala Dosa","Indian","Snack",149,4.6,1,"Masala dosa","Crisp rice crepe filled with spiced potato.",""],
  ["Chole Bhature","Indian","Main course",169,4.4,1,"Chole bhature","Spicy chickpea curry with fluffy fried bread.",""],
  ["Dal Makhani","Indian","Main course",189,4.5,1,"Dal makhani","Black lentils simmered overnight with cream.",""],
  ["Pav Bhaji","Indian","Snack",139,4.6,1,"Pav bhaji","Mumbai-style buttery vegetable mash with toasted pav.","⭐ Popular"],
  ["Gulab Jamun","Indian","Dessert",99,4.7,1,"Gulab jamun","Warm milk dumplings in cardamom syrup.",""],

  ["Margherita Pizza","Italian","Main course",299,4.6,1,"Pizza Margherita","Tomato, fresh mozzarella and basil on a thin crust.","⭐ Popular"],
  ["Pepperoni Pizza","Italian","Main course",349,4.5,0,"Pepperoni","Loaded with crisp pepperoni and mozzarella.",""],
  ["Penne Arrabbiata","Italian","Main course",259,4.3,1,"Penne","Penne in a spicy garlic tomato sauce.",""],
  ["Baked Lasagna","Italian","Main course",329,4.7,0,"Lasagne","Layers of pasta, ragu and bubbling cheese.","🏆 Best seller"],
  ["Mushroom Risotto","Italian","Rice & Noodles",289,4.4,1,"Risotto","Creamy arborio rice with sautéed mushrooms.",""],
  ["Garlic Bread","Italian","Starter",129,4.5,1,"Garlic bread","Golden, buttery and loaded with garlic.",""],
  ["Bruschetta","Italian","Starter",159,4.2,1,"Bruschetta","Toasted bread with tomato, basil and olive oil.",""],
  ["Tiramisu","Italian","Dessert",189,4.8,1,"Tiramisu","Coffee-soaked layers of mascarpone cream.",""],

  ["Bibimbap","Korean","Rice & Noodles",319,4.6,0,"Bibimbap","Rice bowl with vegetables, egg and gochujang.","🔥 Trending"],
  ["Kimchi Fried Rice","Korean","Rice & Noodles",269,4.4,0,"Kimchi bokkeumbap","Smoky fried rice with tangy kimchi.",""],
  ["Tteokbokki","Korean","Snack",229,4.5,1,"Tteokbokki","Chewy rice cakes in sweet-spicy sauce.","🔥 Trending"],
  ["Korean Fried Chicken","Korean","Main course",349,4.8,0,"Korean fried chicken","Double-fried, extra crunchy, glazed in sauce.","🏆 Best seller"],
  ["Bulgogi Bowl","Korean","Main course",359,4.5,0,"Bulgogi","Marinated beef slices over steamed rice.",""],
  ["Japchae","Korean","Rice & Noodles",279,4.3,1,"Japchae","Glass noodles stir-fried with vegetables.",""],
  ["Kimbap","Korean","Snack",199,4.4,0,"Gimbap","Seaweed rice rolls packed with fillings.",""],
  ["Bingsu","Korean","Dessert",179,4.6,1,"Bingsu","Shaved milk ice with sweet toppings.",""],

  ["Spicy Ramen","Japanese","Rice & Noodles",249,4.8,0,"Ramen","Rich broth, springy noodles and a soft egg.","🔥 Trending"],
  ["Salmon Sushi Platter","Japanese","Main course",449,4.7,0,"Sushi","Hand-rolled nigiri and maki, served with wasabi.",""],
  ["Chicken Katsu Curry","Japanese","Main course",329,4.6,0,"Japanese curry","Crumbed cutlet with mild Japanese curry.",""],
  ["Veg Tempura","Japanese","Starter",229,4.3,1,"Tempura","Light, crisp battered vegetables.",""],
  ["Takoyaki","Japanese","Snack",199,4.4,0,"Takoyaki","Octopus balls with sauce and bonito flakes.",""],
  ["Miso Soup","Japanese","Soup",99,4.2,1,"Miso soup","Warming soybean broth with tofu and seaweed.",""],
  ["Okonomiyaki","Japanese","Snack",289,4.3,0,"Okonomiyaki","Savoury cabbage pancake with sauce.",""],
  ["Matcha Mochi","Japanese","Dessert",149,4.5,1,"Mochi","Soft rice cake with sweet matcha filling.",""],

  ["Veg Hakka Noodles","Chinese","Rice & Noodles",189,4.4,1,"Chow mein","Wok-tossed noodles with crunchy vegetables.",""],
  ["Chicken Manchurian","Chinese","Starter",249,4.5,0,"Chicken Manchurian","Crispy chicken in a tangy soy-garlic sauce.","⭐ Popular"],
  ["Dim Sum Basket","Chinese","Starter",219,4.6,0,"Dim sum","Steamed dumplings with chilli oil.",""],
  ["Kung Pao Chicken","Chinese","Main course",289,4.5,0,"Kung Pao chicken","Peanuts, chillies and tender chicken.",""],
  ["Veg Fried Rice","Chinese","Rice & Noodles",169,4.3,1,"Fried rice","Classic wok fried rice with spring onion.",""],
  ["Hot & Sour Soup","Chinese","Soup",129,4.2,1,"Hot and sour soup","Peppery, tangy and comforting.",""],
  ["Chilli Paneer","Chinese","Starter",229,4.6,1,"Indian Chinese cuisine","Crisp paneer tossed with peppers.",""],
  ["Spring Rolls","Chinese","Starter",149,4.4,1,"Spring roll","Golden rolls with a sweet chilli dip.",""],

  ["Chicken Tacos","Mexican","Main course",249,4.6,0,"Taco","Soft tortillas, grilled chicken, salsa and lime.","🔥 Trending"],
  ["Veg Burrito Bowl","Mexican","Main course",229,4.4,1,"Burrito","Rice, beans, corn and guacamole.",""],
  ["Nachos Supreme","Mexican","Snack",199,4.5,1,"Nachos","Crunchy chips, melted cheese and jalapeños.","⭐ Popular"],
  ["Cheese Quesadilla","Mexican","Snack",239,4.4,1,"Quesadilla","Grilled tortilla stuffed with melty cheese.",""],
  ["Chicken Enchiladas","Mexican","Main course",299,4.5,0,"Enchilada","Rolled tortillas baked in red sauce.",""],
  ["Guacamole & Chips","Mexican","Starter",179,4.3,1,"Guacamole","Fresh avocado dip with warm tortilla chips.",""],
  ["Churros","Mexican","Dessert",149,4.7,1,"Churro","Cinnamon sugar sticks with chocolate dip.",""],
  ["Chicken Fajitas","Mexican","Main course",349,4.6,0,"Fajita","Sizzling peppers and chicken with tortillas.",""]
];

const SEED_FOODS = RAW.map((r, i) => ({
  id: "d" + (i + 1), name: r[0], cuisine: r[1], category: r[2], price: r[3],
  rating: r[4], veg: !!r[5], wiki: r[6], desc: r[7], badge: r[8], img: ""
}));

// Combos are fixed bundles (not editable in admin)
const COMBOS = [
  { id: "c1", name: "Italian Feast", items: "Pizza + Pasta + Cold drink",          old: 599, price: 449, wikis: ["Pizza", "Pasta"],         cuisine: "Italian" },
  { id: "c2", name: "Asian Delight", items: "Ramen + Dumplings + Green tea",       old: 549, price: 399, wikis: ["Ramen", "Dim sum"],       cuisine: "Japanese" },
  { id: "c3", name: "Desi Thali",    items: "Thali + Naan + Gulab jamun",          old: 499, price: 369, wikis: ["Thali", "Naan"],          cuisine: "Indian" }
];