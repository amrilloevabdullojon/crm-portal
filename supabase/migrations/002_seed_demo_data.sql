insert into public.users (name, phone, role, telegram_chat_id)
values
  ('Demo Admin', '+998000000001', 'admin', null),
  ('Demo Client', '+998000000002', 'client', null)
on conflict (phone) do nothing;

insert into public.clinics (name, amo_deal_id, status, drive_folder_url, manager_user_id)
select 'Demo Clinic', 100001, 'data_collection', null, admin_user.id
from public.users admin_user
where admin_user.phone = '+998000000001'
on conflict (amo_deal_id) do nothing;

insert into public.clinic_users (clinic_id, user_id, clinic_role)
select clinic.id, client_user.id, 'owner'
from public.clinics clinic
cross join public.users client_user
where clinic.amo_deal_id = 100001
  and client_user.phone = '+998000000002'
on conflict (clinic_id, user_id) do nothing;

insert into public.module_templates (name, sort_order)
values
  ('Общая информация', 10),
  ('Прайс', 20),
  ('Врачи', 30),
  ('Услуги', 40)
on conflict (name) do nothing;

insert into public.clinic_modules (clinic_id, template_id, name, status, manager_comment)
select clinic.id, template.id, template.name,
  case template.name
    when 'Общая информация' then 'accepted'
    when 'Прайс' then 'review'
    when 'Врачи' then 'needs_revision'
    else 'collection'
  end,
  case template.name
    when 'Врачи' then 'Нужен файл с актуальными должностями.'
    else null
  end
from public.clinics clinic
join public.module_templates template on template.name in ('Общая информация', 'Прайс', 'Врачи', 'Услуги')
where clinic.amo_deal_id = 100001
on conflict (clinic_id, name) do nothing;
