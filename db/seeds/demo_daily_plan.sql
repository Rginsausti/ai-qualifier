-- Demo seed for dashboards: daily plan + basic logs
-- Replace :user_id with a real user UUID before running.

-- Example daily plan
insert into public.daily_plans (user_id, date, content)
values
  (:user_id, current_date, jsonb_build_object(
    'morning', jsonb_build_object('title', 'Desayuno con fibra', 'detail', 'Avena + manzana + semillas'),
    'lunch',   jsonb_build_object('title', 'Almuerzo vegetal', 'detail', 'Bowl de legumbres con hojas verdes'),
    'dinner',  jsonb_build_object('title', 'Cena liviana', 'detail', 'Sopa de calabaza + proteína magra'),
    'tip',     'Tomá agua cada 90 minutos para sostener energía'
  ));

-- Optional: nutrition + water logs to show progress bars
insert into public.nutrition_logs (user_id, name, calories, protein, carbs, fats, meal_type)
values
  (:user_id, 'Yogur con frutos rojos', 220, 18, 30, 6, 'breakfast'),
  (:user_id, 'Bowl de lentejas', 520, 32, 60, 14, 'lunch');

insert into public.water_logs (user_id, amount_ml)
values
  (:user_id, 300),
  (:user_id, 400);

-- Optional: quick log to hydrate mindful widget
insert into public.quick_logs (user_id, energy, hunger, craving, notes)
values
  (:user_id, 'medium', 3, 'fresh', 'Check-in de prueba para la demo.');
