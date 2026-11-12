import type { ItemGlyph } from '@yallist/domain';
import type { LucideIcon } from 'lucide-react-native';
// One import per icon: Metro bundles everything a module imports, so the package's index would
// ship all of Lucide.
import Apple from 'lucide-react-native/icons/apple';
import Armchair from 'lucide-react-native/icons/armchair';
import Avocado from 'lucide-react-native/icons/avocado';
import Axe from 'lucide-react-native/icons/axe';
import Baby from 'lucide-react-native/icons/baby';
import Backpack from 'lucide-react-native/icons/backpack';
import Bacon from 'lucide-react-native/icons/bacon';
import Balloon from 'lucide-react-native/icons/balloon';
import Banana from 'lucide-react-native/icons/banana';
import Bandage from 'lucide-react-native/icons/bandage';
import Banknote from 'lucide-react-native/icons/banknote';
import Barrel from 'lucide-react-native/icons/barrel';
import Bath from 'lucide-react-native/icons/bath';
import Battery from 'lucide-react-native/icons/battery';
import BatteryCharging from 'lucide-react-native/icons/battery-charging';
import Bean from 'lucide-react-native/icons/bean';
import Bed from 'lucide-react-native/icons/bed';
import BedSingle from 'lucide-react-native/icons/bed-single';
import Beef from 'lucide-react-native/icons/beef';
import Beer from 'lucide-react-native/icons/beer';
import Bike from 'lucide-react-native/icons/bike';
import Binoculars from 'lucide-react-native/icons/binoculars';
import Bird from 'lucide-react-native/icons/bird';
import Blender from 'lucide-react-native/icons/blender';
import Bone from 'lucide-react-native/icons/bone';
import BookOpen from 'lucide-react-native/icons/book-open';
import BottleWine from 'lucide-react-native/icons/bottle-wine';
import BriefcaseMedical from 'lucide-react-native/icons/briefcase-medical';
import Broccoli from 'lucide-react-native/icons/broccoli';
import Broom from 'lucide-react-native/icons/broom';
import Bug from 'lucide-react-native/icons/bug';
import Cake from 'lucide-react-native/icons/cake';
import CakeSlice from 'lucide-react-native/icons/cake-slice';
import Camera from 'lucide-react-native/icons/camera';
import Can from 'lucide-react-native/icons/can';
import Candy from 'lucide-react-native/icons/candy';
import Car from 'lucide-react-native/icons/car';
import Carrot from 'lucide-react-native/icons/carrot';
import Cat from 'lucide-react-native/icons/cat';
import Cherry from 'lucide-react-native/icons/cherry';
import ChessKnight from 'lucide-react-native/icons/chess-knight';
import Citrus from 'lucide-react-native/icons/citrus';
import Coffee from 'lucide-react-native/icons/coffee';
import Coins from 'lucide-react-native/icons/coins';
import Compass from 'lucide-react-native/icons/compass';
import Cookie from 'lucide-react-native/icons/cookie';
import CookingPot from 'lucide-react-native/icons/cooking-pot';
import CreditCard from 'lucide-react-native/icons/credit-card';
import Croissant from 'lucide-react-native/icons/croissant';
import CupSoda from 'lucide-react-native/icons/cup-soda';
import Cupcake from 'lucide-react-native/icons/cupcake';
import Dessert from 'lucide-react-native/icons/dessert';
import Dices from 'lucide-react-native/icons/dices';
import Dog from 'lucide-react-native/icons/dog';
import Donut from 'lucide-react-native/icons/donut';
import Drill from 'lucide-react-native/icons/drill';
import Drone from 'lucide-react-native/icons/drone';
import Droplet from 'lucide-react-native/icons/droplet';
import Drum from 'lucide-react-native/icons/drum';
import Drumstick from 'lucide-react-native/icons/drumstick';
import Dumbbell from 'lucide-react-native/icons/dumbbell';
import Egg from 'lucide-react-native/icons/egg';
import EggFried from 'lucide-react-native/icons/egg-fried';
import FireExtinguisher from 'lucide-react-native/icons/fire-extinguisher';
import Fish from 'lucide-react-native/icons/fish';
import FishingHook from 'lucide-react-native/icons/fishing-hook';
import FishingRod from 'lucide-react-native/icons/fishing-rod';
import Flame from 'lucide-react-native/icons/flame';
import FlameKindling from 'lucide-react-native/icons/flame-kindling';
import Flashlight from 'lucide-react-native/icons/flashlight';
import Footprints from 'lucide-react-native/icons/footprints';
import Fuel from 'lucide-react-native/icons/fuel';
import Gift from 'lucide-react-native/icons/gift';
import GlassWater from 'lucide-react-native/icons/glass-water';
import Glasses from 'lucide-react-native/icons/glasses';
import Grape from 'lucide-react-native/icons/grape';
import Guitar from 'lucide-react-native/icons/guitar';
import Ham from 'lucide-react-native/icons/ham';
import Hamburger from 'lucide-react-native/icons/hamburger';
import Hammer from 'lucide-react-native/icons/hammer';
import HandPlatter from 'lucide-react-native/icons/hand-platter';
import Handbag from 'lucide-react-native/icons/handbag';
import HardHat from 'lucide-react-native/icons/hard-hat';
import HatGlasses from 'lucide-react-native/icons/hat-glasses';
import Headphones from 'lucide-react-native/icons/headphones';
import IceCreamCone from 'lucide-react-native/icons/ice-cream-cone';
import IdCard from 'lucide-react-native/icons/id-card';
import Kayak from 'lucide-react-native/icons/kayak';
import Lamp from 'lucide-react-native/icons/lamp';
import Laptop from 'lucide-react-native/icons/laptop';
import Leaf from 'lucide-react-native/icons/leaf';
import LeafyGreen from 'lucide-react-native/icons/leafy-green';
import LifeBuoy from 'lucide-react-native/icons/life-buoy';
import Lollipop from 'lucide-react-native/icons/lollipop';
import Luggage from 'lucide-react-native/icons/luggage';
import Map from 'lucide-react-native/icons/map';
import Martini from 'lucide-react-native/icons/martini';
import Microwave from 'lucide-react-native/icons/microwave';
import Milk from 'lucide-react-native/icons/milk';
import MirrorRound from 'lucide-react-native/icons/mirror-round';
import Mop from 'lucide-react-native/icons/mop';
import MountainSnow from 'lucide-react-native/icons/mountain-snow';
import Nut from 'lucide-react-native/icons/nut';
import Package from 'lucide-react-native/icons/package';
import Parasol from 'lucide-react-native/icons/parasol';
import PartyPopper from 'lucide-react-native/icons/party-popper';
import PawPrint from 'lucide-react-native/icons/paw-print';
import Pencil from 'lucide-react-native/icons/pencil';
import PerfumeBottle from 'lucide-react-native/icons/perfume-bottle';
import Piano from 'lucide-react-native/icons/piano';
import Pill from 'lucide-react-native/icons/pill';
import PillBottle from 'lucide-react-native/icons/pill-bottle';
import Pizza from 'lucide-react-native/icons/pizza';
import PlayingCards from 'lucide-react-native/icons/playing-cards';
import Plug from 'lucide-react-native/icons/plug';
import PocketKnife from 'lucide-react-native/icons/pocket-knife';
import Popcorn from 'lucide-react-native/icons/popcorn';
import Popsicle from 'lucide-react-native/icons/popsicle';
import Projector from 'lucide-react-native/icons/projector';
import Puzzle from 'lucide-react-native/icons/puzzle';
import Radio from 'lucide-react-native/icons/radio';
import Refrigerator from 'lucide-react-native/icons/refrigerator';
import RockingChair from 'lucide-react-native/icons/rocking-chair';
import Ruler from 'lucide-react-native/icons/ruler';
import Salad from 'lucide-react-native/icons/salad';
import Sandwich from 'lucide-react-native/icons/sandwich';
import Scissors from 'lucide-react-native/icons/scissors';
import Scooter from 'lucide-react-native/icons/scooter';
import Shell from 'lucide-react-native/icons/shell';
import Shirt from 'lucide-react-native/icons/shirt';
import ShoppingBag from 'lucide-react-native/icons/shopping-bag';
import ShoppingBasket from 'lucide-react-native/icons/shopping-basket';
import Shovel from 'lucide-react-native/icons/shovel';
import ShowerHead from 'lucide-react-native/icons/shower-head';
import Shrimp from 'lucide-react-native/icons/shrimp';
import Smartphone from 'lucide-react-native/icons/smartphone';
import Snowflake from 'lucide-react-native/icons/snowflake';
import SoapDispenserDroplet from 'lucide-react-native/icons/soap-dispenser-droplet';
import SolarPanel from 'lucide-react-native/icons/solar-panel';
import Soup from 'lucide-react-native/icons/soup';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Speaker from 'lucide-react-native/icons/speaker';
import Spool from 'lucide-react-native/icons/spool';
import SportShoe from 'lucide-react-native/icons/sport-shoe';
import SprayCan from 'lucide-react-native/icons/spray-can';
import Sprout from 'lucide-react-native/icons/sprout';
import Table from 'lucide-react-native/icons/table';
import Tablet from 'lucide-react-native/icons/tablet';
import Telescope from 'lucide-react-native/icons/telescope';
import Tent from 'lucide-react-native/icons/tent';
import TentTree from 'lucide-react-native/icons/tent-tree';
import Thermometer from 'lucide-react-native/icons/thermometer';
import Ticket from 'lucide-react-native/icons/ticket';
import Toilet from 'lucide-react-native/icons/toilet';
import Toothbrush from 'lucide-react-native/icons/toothbrush';
import TowelRack from 'lucide-react-native/icons/towel-rack';
import ToyBrick from 'lucide-react-native/icons/toy-brick';
import Trash from 'lucide-react-native/icons/trash';
import TubeLotion from 'lucide-react-native/icons/tube-lotion';
import Umbrella from 'lucide-react-native/icons/umbrella';
import Utensils from 'lucide-react-native/icons/utensils';
import Vegan from 'lucide-react-native/icons/vegan';
import VenetianMask from 'lucide-react-native/icons/venetian-mask';
import Volleyball from 'lucide-react-native/icons/volleyball';
import Wallet from 'lucide-react-native/icons/wallet';
import WashingMachine from 'lucide-react-native/icons/washing-machine';
import Watch from 'lucide-react-native/icons/watch';
import WavesHorizontal from 'lucide-react-native/icons/waves-horizontal';
import Wheat from 'lucide-react-native/icons/wheat';
import Whistle from 'lucide-react-native/icons/whistle';
import Wine from 'lucide-react-native/icons/wine';
import Wrench from 'lucide-react-native/icons/wrench';

/** Each catalog icon name (packages/domain/src/catalog-glyphs.ts) and its Lucide component. */
export const ITEM_GLYPHS: Record<ItemGlyph, LucideIcon> = {
  apple: Apple,
  armchair: Armchair,
  avocado: Avocado,
  axe: Axe,
  baby: Baby,
  backpack: Backpack,
  bacon: Bacon,
  balloon: Balloon,
  banana: Banana,
  bandage: Bandage,
  banknote: Banknote,
  barrel: Barrel,
  bath: Bath,
  battery: Battery,
  'battery-charging': BatteryCharging,
  bean: Bean,
  bed: Bed,
  'bed-single': BedSingle,
  beef: Beef,
  beer: Beer,
  bike: Bike,
  binoculars: Binoculars,
  bird: Bird,
  blender: Blender,
  bone: Bone,
  'book-open': BookOpen,
  'bottle-wine': BottleWine,
  'briefcase-medical': BriefcaseMedical,
  broccoli: Broccoli,
  broom: Broom,
  bug: Bug,
  cake: Cake,
  'cake-slice': CakeSlice,
  camera: Camera,
  can: Can,
  candy: Candy,
  car: Car,
  carrot: Carrot,
  cat: Cat,
  cherry: Cherry,
  'chess-knight': ChessKnight,
  citrus: Citrus,
  coffee: Coffee,
  coins: Coins,
  compass: Compass,
  cookie: Cookie,
  'cooking-pot': CookingPot,
  'credit-card': CreditCard,
  croissant: Croissant,
  'cup-soda': CupSoda,
  cupcake: Cupcake,
  dessert: Dessert,
  dices: Dices,
  dog: Dog,
  donut: Donut,
  drill: Drill,
  drone: Drone,
  droplet: Droplet,
  drum: Drum,
  drumstick: Drumstick,
  dumbbell: Dumbbell,
  egg: Egg,
  'egg-fried': EggFried,
  'fire-extinguisher': FireExtinguisher,
  fish: Fish,
  'fishing-hook': FishingHook,
  'fishing-rod': FishingRod,
  flame: Flame,
  'flame-kindling': FlameKindling,
  flashlight: Flashlight,
  footprints: Footprints,
  fuel: Fuel,
  gift: Gift,
  'glass-water': GlassWater,
  glasses: Glasses,
  grape: Grape,
  guitar: Guitar,
  ham: Ham,
  hamburger: Hamburger,
  hammer: Hammer,
  'hand-platter': HandPlatter,
  handbag: Handbag,
  'hard-hat': HardHat,
  'hat-glasses': HatGlasses,
  headphones: Headphones,
  'ice-cream-cone': IceCreamCone,
  'id-card': IdCard,
  kayak: Kayak,
  lamp: Lamp,
  laptop: Laptop,
  leaf: Leaf,
  'leafy-green': LeafyGreen,
  'life-buoy': LifeBuoy,
  lollipop: Lollipop,
  luggage: Luggage,
  map: Map,
  martini: Martini,
  microwave: Microwave,
  milk: Milk,
  'mirror-round': MirrorRound,
  mop: Mop,
  'mountain-snow': MountainSnow,
  nut: Nut,
  package: Package,
  parasol: Parasol,
  'party-popper': PartyPopper,
  'paw-print': PawPrint,
  pencil: Pencil,
  'perfume-bottle': PerfumeBottle,
  piano: Piano,
  pill: Pill,
  'pill-bottle': PillBottle,
  pizza: Pizza,
  'playing-cards': PlayingCards,
  plug: Plug,
  'pocket-knife': PocketKnife,
  popcorn: Popcorn,
  popsicle: Popsicle,
  projector: Projector,
  puzzle: Puzzle,
  radio: Radio,
  refrigerator: Refrigerator,
  'rocking-chair': RockingChair,
  ruler: Ruler,
  salad: Salad,
  sandwich: Sandwich,
  scissors: Scissors,
  scooter: Scooter,
  shell: Shell,
  shirt: Shirt,
  'shopping-bag': ShoppingBag,
  'shopping-basket': ShoppingBasket,
  shovel: Shovel,
  'shower-head': ShowerHead,
  shrimp: Shrimp,
  smartphone: Smartphone,
  snowflake: Snowflake,
  'soap-dispenser-droplet': SoapDispenserDroplet,
  'solar-panel': SolarPanel,
  soup: Soup,
  sparkles: Sparkles,
  speaker: Speaker,
  spool: Spool,
  'sport-shoe': SportShoe,
  'spray-can': SprayCan,
  sprout: Sprout,
  table: Table,
  tablet: Tablet,
  telescope: Telescope,
  tent: Tent,
  'tent-tree': TentTree,
  thermometer: Thermometer,
  ticket: Ticket,
  toilet: Toilet,
  toothbrush: Toothbrush,
  'towel-rack': TowelRack,
  'toy-brick': ToyBrick,
  trash: Trash,
  'tube-lotion': TubeLotion,
  umbrella: Umbrella,
  utensils: Utensils,
  vegan: Vegan,
  'venetian-mask': VenetianMask,
  volleyball: Volleyball,
  wallet: Wallet,
  'washing-machine': WashingMachine,
  watch: Watch,
  'waves-horizontal': WavesHorizontal,
  wheat: Wheat,
  whistle: Whistle,
  wine: Wine,
  wrench: Wrench,
};
