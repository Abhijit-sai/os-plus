alter table public.item_types
  add column if not exists icon_kind text,
  add column if not exists icon_name text,
  add column if not exists icon_color text;

update public.item_types
set icon_kind = 'emoji'
where icon_emoji is not null
  and icon_kind is null;

alter table public.item_types drop constraint if exists item_types_icon_kind_check;
alter table public.item_types add constraint item_types_icon_kind_check
check (icon_kind is null or icon_kind in ('emoji', 'lucide'));

alter table public.item_types drop constraint if exists item_types_icon_name_shape_check;
alter table public.item_types add constraint item_types_icon_name_shape_check
check (
  icon_name is null
  or (
    icon_name = btrim(icon_name)
    and char_length(icon_name) between 1 and 64
    and icon_name ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  )
);

alter table public.item_types drop constraint if exists item_types_icon_color_check;
alter table public.item_types add constraint item_types_icon_color_check
check (icon_color is null or icon_color in ('default', 'slate', 'red', 'orange', 'amber', 'emerald', 'blue', 'violet', 'pink'));

alter table public.item_types drop constraint if exists item_types_icon_selection_check;
alter table public.item_types add constraint item_types_icon_selection_check
check (
  (icon_kind is null and icon_emoji is null and icon_name is null and icon_color is null)
  or (icon_kind = 'emoji' and icon_emoji is not null and icon_name is null and icon_color is null)
  or (icon_kind = 'lucide' and icon_emoji is null and icon_name is not null and icon_color is not null)
);

comment on column public.item_types.icon_kind is
  'Optional internal item icon kind: emoji or lucide. Null uses the default garment icon.';
comment on column public.item_types.icon_name is
  'Optional kebab-case Lucide icon name for authenticated internal surfaces.';
comment on column public.item_types.icon_color is
  'Optional controlled color token for a selected Lucide icon.';
