import Image from "next/image";
import Link from "next/link";
import {
  Diamond,
  Headphones,
  Menu,
  PencilRuler,
  Shirt,
  Sofa,
  Sparkles,
  Sprout,
  Star,
  Volleyball,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { getMessages } from "@/lib/messages";
import { catalogQuickSearchLinks } from "@/lib/catalog-taxonomy";

type CategoryMegaMenuProps = {
  triggerLabel?: string;
  showMenuIcon?: boolean;
  triggerClassName?: string;
  panelClassName?: string;
  widthClassName?: string;
  languageCode?: string;
};

type CategoryLink = {
  slug: string;
  title: string;
  icon: LucideIcon;
};

type CategoryProduct = {
  query: string;
  title: string;
  image: string;
};

export function CategoryMegaMenu({
  triggerLabel,
  showMenuIcon = true,
  triggerClassName = "inline-flex h-full items-center gap-3 border-b-2 border-transparent pr-2 hover:border-[#222]",
  panelClassName = "top-full",
  widthClassName = "w-[1360px]",
  languageCode,
}: CategoryMegaMenuProps) {
  const messages = getMessages(languageCode);
  const resolvedTriggerLabel = triggerLabel ?? messages.nav.categories;
  const categoryLinks: CategoryLink[] = [
    { slug: "for-you", title: messages.categoryMenu.forYou, icon: Star },
    { slug: "consumer-electronics", title: messages.categoryMenu.electronics, icon: Headphones },
    { slug: "jewelry-watches", title: messages.categoryMenu.jewelry, icon: Diamond },
    { slug: "office-supplies", title: messages.categoryMenu.office, icon: PencilRuler },
    { slug: "agriculture-food", title: messages.categoryMenu.agriculture, icon: Wheat },
    { slug: "fashion-accessories", title: messages.categoryMenu.fashion, icon: Shirt },
    { slug: "home-garden", title: messages.categoryMenu.home, icon: Sofa },
    { slug: "sports-leisure", title: messages.categoryMenu.sports, icon: Volleyball },
    { slug: "sportswear-clothing", title: messages.categoryMenu.sportswear, icon: Sprout },
  ];
  const categoryProducts: CategoryProduct[] = [
    {
      query: catalogQuickSearchLinks[0].query,
      title: messages.categoryMenu.mouse,
      image: "https://s.alicdn.com/@sc04/kf/H097752b8b24344aebcabb135315e1a8d2.jpg_350x350.jpg",
    },
    {
      query: catalogQuickSearchLinks[1].query,
      title: messages.categoryMenu.gamingMouse,
      image: "https://s.alicdn.com/@sc04/kf/H9d54069b496a4915a948cb6d88ed0435j.jpg_350x350.jpg",
    },
    {
      query: catalogQuickSearchLinks[2].query,
      title: messages.categoryMenu.mousePad,
      image: "https://s.alicdn.com/@sc04/kf/A9b5ae44e0d0c4feba3f2670fe576e8eck.jpg_350x350.jpg",
    },
    {
      query: catalogQuickSearchLinks[3].query,
      title: messages.categoryMenu.nosePiercing,
      image: "https://s.alicdn.com/@sc04/kf/Hd3d4e4b17e974cf4905556da65241a90t.jpg_350x350.jpg",
    },
    {
      query: catalogQuickSearchLinks[4].query,
      title: messages.categoryMenu.piercingJewelry,
      image: "https://s.alicdn.com/@sc04/kf/Hd3d4e4b17e974cf4905556da65241a90t.jpg_350x350.jpg",
    },
    {
      query: catalogQuickSearchLinks[5].query,
      title: messages.categoryMenu.tablet,
      image: "https://s.alicdn.com/@sc04/kf/Hceaca7de363f49c5b1ff43ce10a17bc9P.jpg_350x350.jpg",
    },
    {
      query: catalogQuickSearchLinks[6].query,
      title: messages.categoryMenu.laptops,
      image: "https://s.alicdn.com/@sc04/kf/H8875a3ee8ddc4ad7b846d7a4fb94c2835.jpg_350x350.jpg",
    },
    {
      query: catalogQuickSearchLinks[7].query,
      title: messages.categoryMenu.battery,
      image: "https://s.alicdn.com/@sc04/kf/H5a5b74ce8bca41bdaeb883513631b6827.png_350x350.jpg",
    },
    {
      query: catalogQuickSearchLinks[8].query,
      title: messages.categoryMenu.keyboardMouse,
      image: "https://s.alicdn.com/@sc04/kf/H9d54069b496a4915a948cb6d88ed0435j.jpg_350x350.jpg",
    },
    {
      query: catalogQuickSearchLinks[9].query,
      title: messages.categoryMenu.wirelessMic,
      image: "https://s.alicdn.com/@sc04/kf/Hade212866dcd410fa307eb672830a249i.jpg_350x350.jpg",
    },
    {
      query: catalogQuickSearchLinks[10].query,
      title: messages.categoryMenu.gamingKeyboards,
      image: "https://s.alicdn.com/@sc04/kf/H9d54069b496a4915a948cb6d88ed0435j.jpg_350x350.jpg",
    },
    {
      query: catalogQuickSearchLinks[11].query,
      title: messages.categoryMenu.gamingLaptops,
      image: "https://s.alicdn.com/@sc04/kf/H8875a3ee8ddc4ad7b846d7a4fb94c2835.jpg_350x350.jpg",
    },
    {
      query: catalogQuickSearchLinks[12].query,
      title: messages.categoryMenu.desktops,
      image: "https://s.alicdn.com/@sc04/kf/H5d39629cd6374a32bea7368985f32f7aR.jpg_350x350.jpg",
    },
    {
      query: catalogQuickSearchLinks[13].query,
      title: messages.categoryMenu.miniPc,
      image: "https://s.alicdn.com/@sc04/kf/H5d39629cd6374a32bea7368985f32f7aR.jpg_350x350.jpg",
    },
  ];

  return (
    <div className="group relative">
      <span className={triggerClassName}>
        {showMenuIcon ? <Menu className="h-4 w-4" /> : null}
        {resolvedTriggerLabel}
      </span>

      <div
        className={[
          "invisible absolute left-0 z-[120] overflow-hidden rounded-b-[10px] border border-[#e5e5e5] bg-white opacity-0 shadow-[0_22px_45px_rgba(0,0,0,0.12)] transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100",
          "-translate-y-1",
          panelClassName,
          widthClassName,
        ].join(" ")}
      >
        <div className="grid min-h-[470px] grid-cols-[430px_minmax(0,1fr)]">
          <div className="border-r border-[#ececec] bg-white px-4 py-6">
            <div className="max-h-[422px] overflow-y-auto pr-2">
              {categoryLinks.map((item, index) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.title}
                    href={`/categories/${item.slug}`}
                    className={[
                      "flex items-center gap-4 px-5 py-5 text-[17px] text-[#222] transition-colors hover:bg-[#f8f8f8]",
                      index === 0 ? "border-l-4 border-[#222] bg-[#f4f4f4] font-semibold" : "border-l-4 border-transparent",
                    ].join(" ")}
                  >
                    <Icon className="h-6 w-6 shrink-0 text-[#333]" />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="bg-white px-8 py-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-[#222]">{messages.categoryMenu.forYou}</h3>
              <Sparkles className="h-5 w-5 text-[#888]" />
            </div>

            <div className="grid grid-cols-7 gap-x-8 gap-y-8">
              {categoryProducts.map((item) => (
                <Link key={item.title} href={`/products?q=${encodeURIComponent(item.query)}`} className="group/item flex flex-col items-center text-center">
                  <div className="relative h-[126px] w-[126px] overflow-hidden rounded-full bg-[#f6f6f6]">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="126px"
                      className="object-contain p-3 transition-transform duration-200 group-hover/item:scale-105"
                    />
                    <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#1a73e8] text-white">
                      ↗
                    </div>
                  </div>
                  <div className="mt-4 line-clamp-2 max-w-[132px] text-[16px] leading-6 text-[#222]">
                    {item.title}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}