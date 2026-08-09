alter table public.item_types add column if not exists icon_emoji text;

alter table public.item_types drop constraint if exists item_types_icon_emoji_shape_check;
alter table public.item_types add constraint item_types_icon_emoji_shape_check
check (icon_emoji is null or (icon_emoji = btrim(icon_emoji) and char_length(icon_emoji) between 1 and 16));

comment on column public.item_types.icon_emoji is
  'Optional single emoji used only on authenticated internal item-type and production surfaces.';
