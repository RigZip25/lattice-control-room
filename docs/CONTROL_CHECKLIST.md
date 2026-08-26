# LATTICE — контрольный список продукта

Обновляется после каждого milestone. Статусы:

- `[x]` — реализовано и проверено;
- `[-]` — реализуется сейчас;
- `[ ]` — запланировано;
- `[U]` — требуется действие владельца;
- `[G]` — заблокировано governance до отдельного разрешения.

## M0. Архитектура и правила безопасности

- [x] Разделение брендов, рынков, экспериментов, контента, дистрибуции, обучения, капитала и аудита.
- [x] Версионируемые полномочия, лимиты, escalation и kill switch.
- [x] Разделение Venture, Treasury и Capital Allocator.
- [x] DRY RUN по умолчанию; реальные расходы и публикации fail-closed.
- [x] Provider-neutral контракты: поставщиков можно заменять без изменения ядра.

## M1. Control Room и дизайн

- [x] Все 22 заявленных экрана доступны как маршруты.
- [x] Тёмная премиальная дизайн-система и усиленная типографика.
- [x] Адаптивный базовый интерфейс для мобильных экранов.
- [x] Карта мира, США, Небраски, Чехии, Италии и Колумбии.
- [x] Добавление новой страны из каталога 180 стран.
- [x] Корректные Unicode-маршруты и контур динамически добавленной страны.
- [-] Полная русская и английская локализация всех внутренних поверхностей.
- [ ] Финальный accessibility-аудит: клавиатура, focus, контраст, screen reader.
- [ ] Визуальная регрессия всех 22 экранов на desktop/tablet/mobile.

## M2. Географическая экспансия

- [x] Модель `мир → макрорегион → страна → административная единица`.
- [x] Страны вне экспансии визуально неактивны; добавленные получают начальную глубину.
- [x] Штаты США и county-level drill-down для Небраски.
- [-] Автоматическое определение принятого административного уровня новой страны.
- [ ] Реестр источников полигонов, лицензий, версий и качества покрытия.
- [ ] Загрузка и кэширование границ регионов новой страны.
- [ ] Кликабельные регионы/counties с проникновением, уверенностью и источниками.
- [ ] Добавление региона в экспансию непосредственно с карты.

## M3. Supabase, аккаунты и изоляция SaaS

- [x] Проект Supabase `Lattice` подключён.
- [x] 13 основных таблиц, индексы, приватный Storage bucket и RLS.
- [x] Автоматическое создание workspace владельца при первом входе.
- [x] Серверный gateway использует только publishable key и JWT пользователя.
- [x] Интерфейс email OTP: отправка кода и проверка 6 цифр.
- [U] В шаблоне Supabase Magic Link заменить ссылку на `{{ .Token }}`.
- [ ] Refresh/logout/revocation жизненного цикла сессии.
- [ ] Google OAuth.
- [ ] Passkey/WebAuthn: Face ID, Touch ID и Windows Hello.
- [ ] Роли OWNER / ADMIN / ANALYST / VIEWER в интерфейсе.
- [ ] Переключение workspace для SaaS-клиентов.

## M4. Onboarding нового бренда

- [x] Паспорт бренда и восьмиэтапный launch journey.
- [x] Локальное сохранение профиля бренда.
- [-] Облачное сохранение и восстановление профиля после входа.
- [ ] Загрузка сайтов, репозиториев, документов, брендбука и аналитики.
- [ ] Извлечение FACT / INFERENCE / UNKNOWN с указанием источников.
- [ ] Growth Contract, claims registry, аудитории, value events и ограничения.
- [ ] Product Intelligence report и список недостающих данных.
- [ ] Предложение рынков, каналов, метрик и тестового бюджета.
- [ ] Подтверждение владельцем только решений выше заданных полномочий.

## M5. Автономный производственный контур

- [x] Контракты ролей Creator, Legal, Executor, QA, Senior Marketing и Analytics.
- [x] Трёхсменный cadence и пятиминутные brainstorming windows.
- [x] Стадии EVIDENCE → PROMPT → LEGAL → EXECUTION → QA → LIBRARY.
- [ ] Durable worker: leases, retries, idempotency и dead-letter handling.
- [ ] Агент Creator изучает победившие креативы и внешние evidence sources.
- [ ] Legal Agent проверяет claims, культуру, дискриминацию и правила канала.
- [ ] Исполнители генерируют изображения, видео, тексты и варианты.
- [ ] QA автоматически отклоняет и отправляет неточные материалы на rework.
- [ ] Senior Marketing формирует очередь распространения и бюджет.
- [ ] Командный центр агрегирует результаты и эскалации.

## M6. Библиотека креативов и инфлюенсеры

- [x] Схема creative assets, lineage, rights, territories и compliance decision.
- [x] Приватный bucket `brand-creatives` с workspace-политиками.
- [x] Схема профилей и взаимодействий с инфлюенсерами.
- [ ] Загрузка файлов с checksum, MIME validation и versioning.
- [ ] Превью изображений, видео, текстов и производных вариантов.
- [ ] Поиск, теги, права, срок лицензии и разрешённые территории.
- [ ] CRM инфлюенсеров: discovery, outreach, переговоры, договор, deliverables.
- [ ] Disclosure/FTC и локальные требования перед публикацией.

## M7. Каналы и распространение

- [x] Расширяемый каталог: search, social, marketplace, SEO/editorial, video, influencer, partnerships, lifecycle и offline.
- [x] Distribution Queue и обязательная ссылка на legal decision.
- [ ] Sandbox-адаптер первого рекламного канала.
- [ ] SEO и редакционный pipeline.
- [ ] YouTube/video pipeline.
- [ ] Regional marketplaces и локальные social networks.
- [ ] Email/push/retention lifecycle.
- [G] Реальная публикация до production-authority и отдельного разрешения.

## M8. Метрики и самообучение

- [x] Канонические Metric Definition/Event и frozen forecast contracts.
- [x] Схема metric observations с источником и payload hash.
- [ ] Нормализация событий из разных каналов.
- [ ] Attribution и incrementality с явно указанной неопределённостью.
- [ ] Сравнение forecast vs actual и автоматические stop conditions.
- [ ] Creative memory: победители, проигравшие и причинные гипотезы.
- [ ] Champion/challenger promotion только после evaluation gates.
- [ ] Market radar для новых каналов, возможностей и изменений правил.

## M9. Финансы, автономность и Venture

- [x] Wallet, settled deposits, project envelopes и reservation ledger.
- [x] Изменяемый владельцем лимит решения и дневной лимит.
- [x] Owner escalation при недостатке полномочий или капитала.
- [ ] Облачная неизменяемая финансовая книга и reconciliation.
- [ ] Sandbox-подключение платёжного провайдера.
- [ ] Bank/PayPal funding adapter после выбора провайдера.
- [ ] Budget pacing, anomaly detection и emergency stop.
- [G] Реальные переводы и расходы до отдельного разрешения владельца.

## M10. Эксплуатация и выпуск

- [x] Typecheck, 58 domain tests, gateway tests и runtime verification.
- [x] Supabase Security Advisor без замечаний.
- [ ] Интеграционные тесты Auth → RLS → brand → market → content job.
- [ ] Audit log для каждого решения агента и внешнего вызова.
- [ ] Observability: errors, queue lag, spend, provider health и cost per generation.
- [ ] Backup/restore и disaster-recovery rehearsal.
- [ ] Staging deployment.
- [ ] Security review, threat model и penetration test.
- [ ] Production readiness review.

## Текущий рабочий пакет

1. `M4` — восстановление брендов из Supabase после OTP-входа.
2. `M4` — источники продукта и evidence register.
3. `M2` — автоматический registry административных уровней и границ.
4. `M10` — сквозной тест OTP → workspace → brand с RLS.

## Действия владельца сейчас

1. `[U]` Настроить email-шаблон Supabase с `{{ .Token }}`.
2. Протестировать OTP после изменения шаблона.
3. Для Google OAuth позднее предоставить OAuth-настройку через Supabase Dashboard; секреты в чат не отправлять.

