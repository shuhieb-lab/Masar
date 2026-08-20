-- مَسار v0.2 — إعداد قاعدة البيانات والمصادقة على Supabase
-- نفّذ الملف كاملًا من: Supabase > SQL Editor > New query

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'مستخدم مَسار',
  role text not null default 'teacher' check (role in ('teacher','vice','admin')),
  subject text,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  grade text not null,
  section text not null,
  created_at timestamptz not null default now(),
  unique (grade, section)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  class_id uuid not null references public.classes(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  teacher_name text not null,
  reason text not null,
  description text not null,
  teacher_action text not null,
  status text not null default 'pending' check (status in ('pending','answered','closed')),
  vice_reply text,
  vice_id uuid references public.profiles(id) on delete set null,
  vice_name text,
  created_at timestamptz not null default now(),
  replied_at timestamptz,
  closed_at timestamptz
);

create index if not exists referrals_teacher_id_idx on public.referrals(teacher_id);
create index if not exists referrals_status_idx on public.referrals(status);
create index if not exists referrals_created_at_idx on public.referrals(created_at desc);
create index if not exists students_class_id_idx on public.students(class_id);

-- إنشاء ملف تلقائي لكل مستخدم جديد في Authentication.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name',''), split_part(coalesce(new.email,'مستخدم مَسار'),'@',1)),
    'teacher'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- دالة آمنة لمعرفة دور المستخدم داخل سياسات RLS بدون التسبب في recursion.
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke all on function public.current_role() from public;
grant execute on function public.current_role() to authenticated;

-- حماية تحديث الإحالة بحيث لا يستطيع المعلم تعديل رد الوكيل أو تفاصيل الإحالة بعد إرسالها.
create or replace function public.enforce_referral_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
begin
  r := public.current_role();

  if r = 'admin' then
    return new;
  elsif r = 'vice' then
    -- الوكيل يكتب الرد ويغير الحالة إلى answered فقط، ولا يغير بيانات الإحالة الأصلية.
    new.student_id := old.student_id;
    new.teacher_id := old.teacher_id;
    new.teacher_name := old.teacher_name;
    new.reason := old.reason;
    new.description := old.description;
    new.teacher_action := old.teacher_action;
    new.created_at := old.created_at;
    new.closed_at := old.closed_at;
    new.vice_id := auth.uid();
    select full_name into new.vice_name from public.profiles where id = auth.uid();
    new.replied_at := coalesce(new.replied_at, now());
    if old.status <> 'pending' or new.status <> 'answered' then
      raise exception 'Vice can only answer pending referrals';
    end if;
    return new;
  elsif r = 'teacher' then
    -- المعلم بعد الرد لا يغير سوى الحالة إلى closed وتاريخ الإغلاق.
    if old.teacher_id <> auth.uid() or old.status <> 'answered' or new.status <> 'closed' then
      raise exception 'Teacher can only close own answered referral';
    end if;
    new.student_id := old.student_id;
    new.teacher_id := old.teacher_id;
    new.teacher_name := old.teacher_name;
    new.reason := old.reason;
    new.description := old.description;
    new.teacher_action := old.teacher_action;
    new.vice_reply := old.vice_reply;
    new.vice_id := old.vice_id;
    new.vice_name := old.vice_name;
    new.created_at := old.created_at;
    new.replied_at := old.replied_at;
    new.closed_at := coalesce(new.closed_at, now());
    return new;
  end if;

  raise exception 'Not allowed';
end;
$$;

drop trigger if exists enforce_referral_update_trigger on public.referrals;
create trigger enforce_referral_update_trigger
before update on public.referrals
for each row execute procedure public.enforce_referral_update();

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.referrals enable row level security;

-- حذف السياسات القديمة عند إعادة تشغيل الملف.
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;
drop policy if exists "classes_select" on public.classes;
drop policy if exists "classes_admin_insert" on public.classes;
drop policy if exists "classes_admin_update" on public.classes;
drop policy if exists "classes_admin_delete" on public.classes;
drop policy if exists "students_select" on public.students;
drop policy if exists "students_admin_insert" on public.students;
drop policy if exists "students_admin_update" on public.students;
drop policy if exists "students_admin_delete" on public.students;
drop policy if exists "referrals_select" on public.referrals;
drop policy if exists "referrals_teacher_insert" on public.referrals;
drop policy if exists "referrals_update" on public.referrals;

create policy "profiles_select"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.current_role() = 'admin');

create policy "profiles_admin_update"
on public.profiles for update
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

create policy "classes_select"
on public.classes for select
to authenticated
using (true);

create policy "classes_admin_insert"
on public.classes for insert
to authenticated
with check (public.current_role() = 'admin');

create policy "classes_admin_update"
on public.classes for update
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

create policy "classes_admin_delete"
on public.classes for delete
to authenticated
using (public.current_role() = 'admin');

create policy "students_select"
on public.students for select
to authenticated
using (true);

create policy "students_admin_insert"
on public.students for insert
to authenticated
with check (public.current_role() = 'admin');

create policy "students_admin_update"
on public.students for update
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

create policy "students_admin_delete"
on public.students for delete
to authenticated
using (public.current_role() = 'admin');

create policy "referrals_select"
on public.referrals for select
to authenticated
using (
  teacher_id = auth.uid()
  or public.current_role() in ('vice','admin')
);

create policy "referrals_teacher_insert"
on public.referrals for insert
to authenticated
with check (
  teacher_id = auth.uid()
  and public.current_role() = 'teacher'
  and status = 'pending'
);

create policy "referrals_update"
on public.referrals for update
to authenticated
using (
  public.current_role() in ('vice','admin')
  or (public.current_role() = 'teacher' and teacher_id = auth.uid() and status = 'answered')
)
with check (
  public.current_role() in ('vice','admin')
  or (public.current_role() = 'teacher' and teacher_id = auth.uid() and status = 'closed')
);

-- تفعيل Realtime لجدول الإحالات (مع عدم التكرار عند إعادة تنفيذ الملف).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'referrals'
  ) then
    alter publication supabase_realtime add table public.referrals;
  end if;
end $$;

-- ملاحظة مهمة:
-- بعد إنشاء المستخدمين من Authentication > Users، غيّر أدوار الوكيل والمدير من SQL Editor مثل:
-- update public.profiles p set role='admin', full_name='مدير المدرسة'
-- from auth.users u where p.id=u.id and u.email='admin@school.sa';
--
-- update public.profiles p set role='vice', full_name='وكيل شؤون الطلاب'
-- from auth.users u where p.id=u.id and u.email='vice@school.sa';
