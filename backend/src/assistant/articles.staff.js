// Help articles for staff. Each one answers one question about the app.
//
// permission: the staff permission needed to see the article (null = everyone);
// path: the page it's about, linked from the answer;
// keywords: extra words people search with, per language.
// Body lines starting with "1. ", "2. " ... are shown as numbered steps.

module.exports = [
    {
        id: "getting-started",
        permission: null,
        path: "/",
        title: {
            en: "Getting around the app",
            fr: "Se repérer dans l'application",
            ar: "التنقل في التطبيق"
        },
        body: {
            en: "The menu on the left groups the pages by job: Overview (dashboard, reports and the three models), Sales, Catalog, Inventory and Administration. You only see the pages your role can use.\nPress Ctrl+K (Cmd+K on a Mac) anywhere to search customers, orders and products, or jump to a page.\nThe bell shows alerts such as overdue invoices and low stock. The globe switches between English, French and Arabic, and the moon switches dark mode.",
            fr: "Le menu de gauche regroupe les pages par activité : Vue d'ensemble (tableau de bord, rapports et les trois modèles), Ventes, Catalogue, Stock et Administration. Vous ne voyez que les pages autorisées pour votre rôle.\nAppuyez sur Ctrl+K (Cmd+K sur Mac) n'importe où pour chercher un client, une commande ou un produit, ou ouvrir une page.\nLa cloche affiche les alertes (factures en retard, stock bas). Le globe change la langue (anglais, français, arabe) et la lune active le mode sombre.",
            ar: "تجمع القائمة الجانبية الصفحات حسب النشاط: نظرة عامة (لوحة القيادة والتقارير والنماذج الثلاثة)، المبيعات، الكتالوج، المخزون، والإدارة. لا تظهر لك إلا الصفحات المسموح بها لدورك.\nاضغط Ctrl+K (أو Cmd+K على ماك) في أي مكان للبحث عن زبون أو طلبية أو منتج، أو للانتقال إلى صفحة.\nيعرض الجرس التنبيهات مثل الفواتير المتأخرة والمخزون المنخفض. يغيّر رمز الكرة الأرضية اللغة (الإنجليزية، الفرنسية، العربية) ويفعّل رمز القمر الوضع الداكن."
        },
        keywords: {
            en: "start help here features tour menu navigation search shortcut ctrl k dark mode language notifications",
            fr: "début aide menu navigation recherche raccourci mode sombre langue notifications",
            ar: "بداية مساعدة قائمة تنقل بحث اختصار الوضع الداكن لغة تنبيهات"
        }
    },
    {
        id: "dashboard",
        permission: "dashboard.view",
        path: "/",
        title: { en: "What the dashboard shows", fr: "Ce que montre le tableau de bord", ar: "ماذا تعرض لوحة القيادة" },
        body: {
            en: "The dashboard sums up the business: revenue from completed orders, orders by status, what customers owe, recent orders and products running low.\nClick a card or a chart to open the matching list. Revenue excludes VAT and cancelled orders.",
            fr: "Le tableau de bord résume l'activité : chiffre d'affaires des commandes terminées, commandes par statut, montants dus par les clients, commandes récentes et produits en rupture proche.\nCliquez sur une carte ou un graphique pour ouvrir la liste correspondante. Le chiffre d'affaires est hors TVA et sans les commandes annulées.",
            ar: "تلخّص لوحة القيادة النشاط: رقم المعاملات من الطلبيات المكتملة، الطلبيات حسب الحالة، ما يدين به الزبناء، آخر الطلبيات والمنتجات التي قارب مخزونها على النفاد.\nاضغط على بطاقة أو رسم بياني لفتح القائمة المرتبطة به. رقم المعاملات دون احتساب الضريبة والطلبيات الملغاة."
        },
        keywords: { en: "home overview kpi revenue summary", fr: "accueil vue d'ensemble indicateurs chiffre d'affaires résumé", ar: "الرئيسية ملخص مؤشرات رقم المعاملات" }
    },
    {
        id: "create-quote",
        permission: "quotes.view",
        path: "/quotes",
        title: { en: "Preparing and sending a quote", fr: "Préparer et envoyer un devis", ar: "إعداد عرض سعر وإرساله" },
        body: {
            en: "A quote is a price offer the customer can accept before anything is ordered.\n1. Open Quotes and click New quote (or New quote in a customer's drawer).\n2. Choose the customer, add lines and adjust prices or discounts if you negotiated them.\n3. Click Create draft. A draft can still be edited or deleted.\n4. Click Mark as sent once you've sent it. Print quote gives an A4 document.\nA quote is valid for 30 days unless you change the date. After that it shows as Expired.",
            fr: "Un devis est une offre de prix que le client peut accepter avant toute commande.\n1. Ouvrez Devis et cliquez sur Nouveau devis (ou depuis la fiche d'un client).\n2. Choisissez le client, ajoutez les lignes et ajustez les prix ou remises négociés.\n3. Cliquez sur Créer le brouillon. Un brouillon peut encore être modifié ou supprimé.\n4. Cliquez sur Marquer comme envoyé une fois envoyé. Imprimer le devis produit un document A4.\nUn devis est valable 30 jours sauf si vous changez la date. Ensuite il apparaît comme Expiré.",
            ar: "عرض السعر هو عرض أسعار يمكن للزبون قبوله قبل أي طلبية.\n1. افتح عروض الأسعار واضغط على عرض سعر جديد (أو من بطاقة الزبون).\n2. اختر الزبون، أضف الأسطر وعدّل الأسعار أو التخفيضات المتفاوض عليها.\n3. اضغط على إنشاء مسودة. يمكن تعديل المسودة أو حذفها.\n4. اضغط على وضع علامة «مُرسل» بعد إرساله. يعطيك «طباعة عرض السعر» وثيقة A4.\nيبقى عرض السعر صالحًا 30 يومًا ما لم تغيّر التاريخ، وبعدها يظهر كمنتهي الصلاحية."
        },
        keywords: { en: "quote quotation estimate offer devis proposal draft send print validity expired", fr: "devis offre proposition brouillon envoyer imprimer validité expiré", ar: "عرض سعر تسعيرة عرض مسودة إرسال طباعة صلاحية منتهي" }
    },
    {
        id: "convert-quote",
        permission: "quotes.view",
        path: "/quotes",
        title: { en: "Turning an accepted quote into an order", fr: "Transformer un devis accepté en commande", ar: "تحويل عرض سعر مقبول إلى طلبية" },
        body: {
            en: "When the customer agrees, click Mark accepted (customers with portal access can also accept it themselves). Then click Create order.\nThe order keeps the quoted prices, even if catalog prices changed since. Stock is checked when you convert, and a quote can only be converted once.\nIf the customer declines, click Mark rejected. Duplicate makes a new draft with the same lines.",
            fr: "Quand le client est d'accord, cliquez sur Marquer accepté (les clients ayant accès au portail peuvent aussi l'accepter eux-mêmes). Cliquez ensuite sur Créer la commande.\nLa commande garde les prix du devis, même si les prix du catalogue ont changé. Le stock est vérifié lors de la conversion, et un devis ne peut être converti qu'une fois.\nSi le client refuse, cliquez sur Marquer refusé. Dupliquer crée un nouveau brouillon avec les mêmes lignes.",
            ar: "عندما يوافق الزبون، اضغط على وضع علامة «مقبول» (يمكن للزبناء الذين لهم ولوج إلى البوابة قبوله بأنفسهم). ثم اضغط على إنشاء طلبية.\nتحتفظ الطلبية بأسعار عرض السعر حتى لو تغيّرت أسعار الكتالوج. يُتحقق من المخزون عند التحويل، ولا يمكن تحويل عرض السعر إلا مرة واحدة.\nإذا رفض الزبون، اضغط على وضع علامة «مرفوض». أما «نسخ» فينشئ مسودة جديدة بنفس الأسطر."
        },
        keywords: { en: "convert accept accepted quote to order reject decline duplicate", fr: "convertir accepter devis en commande refuser dupliquer", ar: "تحويل قبول عرض سعر إلى طلبية رفض نسخ" }
    },
    {
        id: "create-order",
        permission: "orders.view",
        path: "/orders",
        title: { en: "Creating an order", fr: "Créer une commande", ar: "إنشاء طلبية" },
        body: {
            en: "1. Open Orders and click Create order (or New order in a customer's drawer).\n2. Choose the customer and add products with quantities.\n3. Prices fill in from the customer's pricing (price list, volume discounts, contract prices). The form shows which rule applied.\n4. Click Create order. Stock goes down straight away and the order starts as Pending.\nYou can't order more than is in stock. Products marked inactive can't be ordered.",
            fr: "1. Ouvrez Commandes et cliquez sur Créer une commande (ou Nouvelle commande depuis la fiche client).\n2. Choisissez le client et ajoutez les produits avec leurs quantités.\n3. Les prix se remplissent selon la tarification du client (liste de prix, remises sur volume, prix contractuels). Le formulaire indique la règle appliquée.\n4. Cliquez sur Créer la commande. Le stock baisse immédiatement et la commande démarre En attente.\nImpossible de commander plus que le stock disponible. Les produits inactifs ne peuvent pas être commandés.",
            ar: "1. افتح الطلبيات واضغط على إنشاء طلبية (أو طلبية جديدة من بطاقة الزبون).\n2. اختر الزبون وأضف المنتجات بكمياتها.\n3. تُملأ الأسعار حسب تسعيرة الزبون (لائحة الأسعار، تخفيضات الكمية، أسعار العقد) ويبيّن النموذج القاعدة المطبقة.\n4. اضغط على إنشاء طلبية. ينقص المخزون فورًا وتبدأ الطلبية بحالة «قيد الانتظار».\nلا يمكن طلب أكثر من المخزون المتوفر، ولا يمكن طلب المنتجات غير النشطة."
        },
        keywords: { en: "new order sale sell create purchase customer order commande", fr: "nouvelle commande vente vendre créer bon de commande client", ar: "طلبية جديدة بيع إنشاء طلب زبون" }
    },
    {
        id: "order-statuses",
        permission: "orders.view",
        path: "/orders",
        title: { en: "Order statuses and cancelling", fr: "Statuts des commandes et annulation", ar: "حالات الطلبيات والإلغاء" },
        body: {
            en: "Orders move from Pending (waiting for review) to Processing (being prepared) to Completed (delivered).\nOpen an order and use Start processing, then Mark completed. Managers, admins and the warehouse can move orders along.\nCancel order is possible until the order is completed. It puts the stock back and the invoice no longer counts as owed. For a completed order, take a return instead.",
            fr: "Les commandes passent de En attente (à vérifier) à En préparation puis à Terminée (livrée).\nOuvrez une commande et utilisez Démarrer la préparation, puis Marquer terminée. Les managers, administrateurs et le magasin peuvent faire avancer les commandes.\nAnnuler la commande est possible tant qu'elle n'est pas terminée : le stock est remis et la facture n'est plus due. Pour une commande terminée, faites plutôt un retour.",
            ar: "تنتقل الطلبيات من «قيد الانتظار» (في انتظار المراجعة) إلى «قيد المعالجة» (قيد التحضير) ثم «مكتملة» (تم التسليم).\nافتح الطلبية واستعمل «بدء المعالجة» ثم «وضع علامة مكتملة». يمكن للمسيرين والمسؤولين وأمين المخزن تحريك الطلبيات.\nيمكن إلغاء الطلبية ما دامت غير مكتملة: يعود المخزون ولا تبقى الفاتورة مستحقة. أما الطلبية المكتملة فسجّل لها إرجاعًا."
        },
        keywords: { en: "status pending processing completed cancel delivered fulfil workflow", fr: "statut en attente préparation terminée annuler livrée", ar: "حالة انتظار معالجة مكتملة إلغاء تسليم" }
    },
    {
        id: "invoices",
        permission: "orders.view",
        path: "/orders",
        title: { en: "Invoices, VAT and payment terms", fr: "Factures, TVA et délais de paiement", ar: "الفواتير والضريبة وآجال الأداء" },
        body: {
            en: "Every order has an invoice. Click Open invoice on an order (or the download icon in Receivables) to view and print it as an A4 page or PDF.\nInvoices add 20% VAT to prices, which are stored excluding VAT, in MAD. Payment is due 30 days after the order date. Invoice numbers look like INV-2026-000123.\nCredit notes and payments are shown on the invoice, so it always shows what's left to pay.",
            fr: "Chaque commande a une facture. Cliquez sur Ouvrir la facture (ou l'icône de téléchargement dans Créances) pour l'afficher et l'imprimer en A4 ou en PDF.\nLes factures ajoutent 20 % de TVA aux prix, enregistrés hors TVA, en MAD. Le paiement est dû 30 jours après la date de commande. Les numéros ressemblent à INV-2026-000123.\nLes avoirs et paiements figurent sur la facture, qui montre donc toujours le reste à payer.",
            ar: "لكل طلبية فاتورة. اضغط على «فتح الفاتورة» (أو أيقونة التحميل في صفحة المستحقات) لعرضها وطباعتها بصيغة A4 أو PDF.\nتضيف الفواتير ضريبة 20% إلى الأسعار المسجلة دون ضريبة وبالدرهم. يُستحق الأداء بعد 30 يومًا من تاريخ الطلبية، وأرقام الفواتير تشبه INV-2026-000123.\nتظهر الإشعارات الدائنة والأداءات على الفاتورة، فهي تبيّن دائمًا المبلغ المتبقي."
        },
        keywords: { en: "invoice bill print pdf vat tax tva 20% due date terms 30 days facture", fr: "facture imprimer pdf tva taxe échéance délai 30 jours", ar: "فاتورة طباعة ضريبة القيمة المضافة تاريخ الاستحقاق أجل 30 يوما" }
    },
    {
        id: "emails",
        permission: "emails.view",
        path: "/emails",
        title: { en: "Emailing invoices and quotes", fr: "Envoyer factures et devis par e-mail", ar: "إرسال الفواتير وعروض الأسعار بالبريد" },
        body: {
            en: "1. Open an order (or a quote) and find Emails, then click Email invoice (or Email to client).\n2. Check the address and the language. They come from the customer, where you can set an email language and turn payment reminders on or off.\n3. Add a message if you like, and click Send. A draft quote is marked as sent at the same time.\nInvoices due in the next few days get an automatic payment reminder, once per invoice. Every email, sent or not, is listed on the Emails page, where you can read it as the client received it. If no mail server is set up, emails are saved there in the outbox instead of being sent.",
            fr: "1. Ouvrez une commande (ou un devis), section E-mails, puis cliquez sur Envoyer la facture (ou Envoyer au client).\n2. Vérifiez l'adresse et la langue. Elles viennent de la fiche client, où l'on choisit la langue des e-mails et active ou non les rappels de paiement.\n3. Ajoutez un message si besoin, puis cliquez sur Envoyer. Un devis en brouillon est marqué comme envoyé en même temps.\nLes factures arrivant à échéance dans les prochains jours reçoivent un rappel automatique, une fois par facture. Tous les e-mails, envoyés ou non, sont listés sur la page E-mails, où vous pouvez les lire tels que le client les a reçus. Sans serveur d'e-mail configuré, ils y sont enregistrés dans la boîte d'envoi au lieu d'être envoyés.",
            ar: "1. افتح طلبية (أو عرض سعر) وانتقل إلى قسم الرسائل، ثم اضغط على «إرسال الفاتورة» (أو «إرسال إلى الزبون»).\n2. تحقق من العنوان واللغة، فهما يأتيان من بطاقة الزبون حيث تُحدد لغة الرسائل وتُفعَّل تذكيرات الأداء أو تُعطَّل.\n3. أضف رسالة إن أردت، ثم اضغط على «إرسال». يُوسم عرض السعر المسودة بـ«مُرسل» في الوقت نفسه.\nتتلقى الفواتير التي يحل أجلها خلال الأيام القليلة القادمة تذكيرًا تلقائيًا، مرة واحدة لكل فاتورة. تظهر كل الرسائل، المرسلة وغير المرسلة، في صفحة الرسائل حيث يمكنك قراءتها كما وصلت إلى الزبون. وإذا لم يُعدّ أي خادم بريد، تُحفظ هناك في صندوق الصادر بدل إرسالها."
        },
        keywords: {
            en: "email mail send invoice quote client reminder payment reminder outbox smtp language",
            fr: "e-mail mail envoyer facture devis client rappel relance boîte d'envoi langue",
            ar: "بريد رسالة إرسال فاتورة عرض سعر زبون تذكير صندوق الصادر لغة"
        }
    },
    {
        id: "record-payment",
        permission: "payments.view",
        path: "/receivables",
        title: { en: "Recording and voiding payments", fr: "Enregistrer et annuler un paiement", ar: "تسجيل الأداءات وإلغاؤها" },
        body: {
            en: "1. In Receivables, click the wallet icon on the invoice, or open the order and use Record payment.\n2. Enter the amount, the date it was received and the method (bank transfer, cheque, cash or card). Partial payments are fine: the rest stays open.\n3. Save. The invoice status updates to Partially paid or Paid.\nTo undo a mistake, use Void payment and give a reason (for example a bounced cheque). Payments are never deleted, so the history stays complete.",
            fr: "1. Dans Créances, cliquez sur l'icône portefeuille de la facture, ou ouvrez la commande et utilisez Enregistrer un paiement.\n2. Saisissez le montant, la date de réception et le mode (virement, chèque, espèces ou carte). Un paiement partiel est possible : le reste reste ouvert.\n3. Enregistrez. Le statut passe à Partiellement payée ou Payée.\nPour corriger une erreur, utilisez Annuler le paiement avec un motif (par exemple un chèque impayé). Les paiements ne sont jamais supprimés, l'historique reste complet.",
            ar: "1. في صفحة المستحقات، اضغط على أيقونة المحفظة بجانب الفاتورة، أو افتح الطلبية واستعمل «تسجيل أداء».\n2. أدخل المبلغ وتاريخ التوصل وطريقة الأداء (تحويل بنكي، شيك، نقدًا أو بطاقة). الأداء الجزئي ممكن ويبقى الباقي مفتوحًا.\n3. احفظ. تتحول حالة الفاتورة إلى «مؤداة جزئيًا» أو «مؤداة».\nلتصحيح خطأ استعمل «إلغاء الأداء» مع ذكر السبب (مثل شيك بدون رصيد). لا تُحذف الأداءات أبدًا فيبقى السجل كاملًا."
        },
        keywords: { en: "payment pay paid record receive cash cheque check transfer card partial void undo refund paiement", fr: "paiement payer encaisser enregistrer chèque virement espèces carte partiel annuler", ar: "أداء دفع تسجيل استلام شيك تحويل نقدا بطاقة جزئي إلغاء" }
    },
    {
        id: "receivables",
        permission: "payments.view",
        path: "/receivables",
        title: { en: "Receivables: who owes what", fr: "Créances : qui doit quoi", ar: "المستحقات: من يدين بماذا" },
        body: {
            en: "Receivables lists every unpaid invoice. The ageing chart groups them by how late they are: not yet due, 1–30, 31–60, 61–90 and 90+ days. Click a bar to filter the list.\nTop debtors shows the customers with the biggest open balance and their oldest late invoice. Export gives a CSV for your accountant.",
            fr: "Créances liste toutes les factures impayées. Le graphique d'ancienneté les regroupe par retard : pas encore échues, 1–30, 31–60, 61–90 et plus de 90 jours. Cliquez sur une barre pour filtrer.\nPrincipaux débiteurs montre les clients au plus gros solde et leur facture la plus en retard. Exporter donne un CSV pour votre comptable.",
            ar: "تعرض صفحة المستحقات كل الفواتير غير المؤداة. يجمعها رسم الأقدمية حسب مدة التأخر: غير مستحقة بعد، 1–30، 31–60، 61–90 وأكثر من 90 يومًا. اضغط على شريط لتصفية القائمة.\nيعرض «أكبر المدينين» الزبناء ذوي أكبر رصيد مفتوح وأقدم فاتورة متأخرة لديهم. ويعطيك «تصدير» ملف CSV لمحاسبك."
        },
        keywords: { en: "receivables debt owed outstanding overdue late unpaid ageing aging debtors collections", fr: "créances dettes impayés en retard ancienneté débiteurs recouvrement", ar: "مستحقات ديون غير مؤداة متأخرة أقدمية مدينين تحصيل" }
    },
    {
        id: "late-payment-risk",
        permission: "payments.view",
        path: "/receivables",
        title: { en: "What the late-payment risk means", fr: "Ce que signifie le risque de retard de paiement", ar: "ماذا يعني خطر التأخر في الأداء" },
        body: {
            en: "For each unpaid invoice that isn't late yet, Receivables shows the chance it will be paid more than 7 days after its due date, for example 72% late risk. Click the badge to see the reasons, such as how often the customer paid late before or that the invoice is unusually large.\nUse the Likely late filter to see invoices worth a reminder before they fall due. The score comes from a model trained on your payment history; its test results are on the Payment risk page.",
            fr: "Pour chaque facture impayée pas encore en retard, Créances affiche la probabilité qu'elle soit payée plus de 7 jours après l'échéance, par exemple Risque de retard : 72 %. Cliquez sur le badge pour voir les raisons, comme la fréquence des retards passés du client ou un montant inhabituel.\nLe filtre Retard probable montre les factures à relancer avant l'échéance. Le score vient d'un modèle entraîné sur votre historique de paiements ; ses résultats de test sont sur la page Risque de paiement.",
            ar: "لكل فاتورة غير مؤداة لم تتأخر بعد، تعرض صفحة المستحقات احتمال أدائها بعد أكثر من 7 أيام من تاريخ الاستحقاق، مثل «خطر التأخر 72%». اضغط على الشارة لترى الأسباب، كعدد مرات تأخر الزبون سابقًا أو أن الفاتورة أكبر من المعتاد.\nاستعمل مرشح «تأخر مرجّح» لرؤية الفواتير التي تستحق التذكير قبل الاستحقاق. تأتي النتيجة من نموذج مدرَّب على سجل الأداءات، ونتائج اختباره في صفحة خطر الأداء."
        },
        keywords: { en: "risk late payment probability score likely late why percent model reminder", fr: "risque retard paiement probabilité score pourquoi pourcentage modèle relance", ar: "خطر تأخر أداء احتمال نسبة لماذا نموذج تذكير" }
    },
    {
        id: "returns",
        permission: "payments.view",
        path: "/credit-notes",
        title: { en: "Returns and credit notes", fr: "Retours et avoirs", ar: "الإرجاعات والإشعارات الدائنة" },
        body: {
            en: "Goods can be returned from a completed order.\n1. Open the order and find Returns, then click Return items.\n2. Enter the quantities coming back and the reason, and say whether each item can go back into stock.\n3. Click Create credit note.\nThe credit note lowers what the customer owes. If they had already paid, it records a refund instead. All credit notes are listed on the Credit notes page and can be printed.",
            fr: "Les marchandises d'une commande terminée peuvent être retournées.\n1. Ouvrez la commande, section Retours, puis cliquez sur Retourner des articles.\n2. Saisissez les quantités retournées et le motif, et indiquez si chaque article retourne en stock.\n3. Cliquez sur Créer l'avoir.\nL'avoir réduit ce que doit le client. S'il avait déjà payé, un remboursement est enregistré. Tous les avoirs sont sur la page Avoirs et peuvent être imprimés.",
            ar: "يمكن إرجاع سلع طلبية مكتملة.\n1. افتح الطلبية، قسم الإرجاعات، ثم اضغط على «إرجاع منتجات».\n2. أدخل الكميات المرجعة والسبب، وحدد هل يعود كل منتج إلى المخزون.\n3. اضغط على «إنشاء إشعار دائن».\nيخفّض الإشعار الدائن ما يدين به الزبون، وإذا كان قد أدى من قبل فيُسجَّل استرداد. توجد كل الإشعارات الدائنة في صفحتها ويمكن طباعتها."
        },
        keywords: { en: "return refund credit note avoir damaged defective wrong item give back", fr: "retour remboursement avoir abîmé défectueux mauvais article", ar: "إرجاع استرداد إشعار دائن تالف معيب منتج خاطئ" }
    },
    {
        id: "customers",
        permission: "customers.view",
        path: "/customers",
        title: { en: "Customers and their details", fr: "Les clients et leur fiche", ar: "الزبناء وبطاقاتهم" },
        body: {
            en: "Customers lists every company you sell to. Click a row to open its drawer: contact details, pricing, portal access, suggested products, order history and, for admins, the change history.\nClick Add customer to create one. From the drawer you can start a New quote or New order for that customer directly.",
            fr: "Clients liste toutes les entreprises à qui vous vendez. Cliquez sur une ligne pour ouvrir la fiche : coordonnées, tarification, accès portail, produits suggérés, historique des commandes et, pour les administrateurs, l'historique des modifications.\nCliquez sur Ajouter un client pour en créer un. Depuis la fiche, vous pouvez lancer directement un Nouveau devis ou une Nouvelle commande.",
            ar: "تعرض صفحة الزبناء كل الشركات التي تبيع لها. اضغط على سطر لفتح البطاقة: معلومات الاتصال، التسعيرة، الولوج إلى البوابة، المنتجات المقترحة، سجل الطلبيات، وسجل التغييرات للمسؤولين.\nاضغط على «إضافة زبون» لإنشاء زبون جديد. ومن البطاقة يمكنك بدء عرض سعر جديد أو طلبية جديدة مباشرة."
        },
        keywords: { en: "customer client company account add edit contact clients", fr: "client entreprise compte ajouter modifier contact", ar: "زبون عميل شركة حساب إضافة تعديل اتصال" }
    },
    {
        id: "portal-access",
        permission: "customers.view",
        path: "/customers",
        title: { en: "Giving a customer portal access", fr: "Donner accès au portail à un client", ar: "منح زبون ولوجًا إلى البوابة" },
        body: {
            en: "Customers can order, download invoices and answer quotes themselves on the client portal.\n1. Open the customer's drawer and go to Portal access.\n2. Click Invite contact, check their name and email, and click Create access.\n3. Send them the email and the temporary password shown once on screen. They should change it after signing in.\nYou can disable an account at any time; they're signed out immediately. Admins and managers can manage portal access.",
            fr: "Les clients peuvent commander, télécharger leurs factures et répondre aux devis eux-mêmes sur le portail client.\n1. Ouvrez la fiche du client, section Accès portail.\n2. Cliquez sur Inviter un contact, vérifiez son nom et son e-mail, puis Créer l'accès.\n3. Envoyez-lui l'e-mail et le mot de passe temporaire affiché une seule fois. Il devra le changer après connexion.\nVous pouvez désactiver un compte à tout moment ; la personne est déconnectée aussitôt. Administrateurs et managers gèrent les accès.",
            ar: "يمكن للزبناء الطلب وتحميل الفواتير والرد على عروض الأسعار بأنفسهم عبر بوابة الزبناء.\n1. افتح بطاقة الزبون وانتقل إلى قسم الولوج إلى البوابة.\n2. اضغط على «دعوة جهة اتصال»، وتحقق من الاسم والبريد، ثم «إنشاء الولوج».\n3. أرسل له البريد وكلمة المرور المؤقتة التي تظهر مرة واحدة على الشاشة، وعليه تغييرها بعد الدخول.\nيمكنك تعطيل الحساب في أي وقت فيُسجَّل خروجه فورًا. يدير المسؤولون والمسيرون الولوج."
        },
        keywords: { en: "portal access invite login account client portal password enable disable", fr: "portail accès inviter connexion compte client mot de passe activer désactiver", ar: "بوابة ولوج دعوة دخول حساب زبون كلمة مرور تفعيل تعطيل" }
    },
    {
        id: "pricing-rules",
        permission: "pricing.view",
        path: "/pricing",
        title: { en: "How customer prices are worked out", fr: "Comment les prix client sont calculés", ar: "كيف تُحسب أسعار الزبناء" },
        body: {
            en: "The Pricing page has three kinds of rules:\n1. Price lists: a percentage off everything for the customers on that list (for example Gold, −6%).\n2. Volume discounts: a percentage off from a minimum quantity, for one category or all products.\n3. Contract prices: a fixed price for one customer and one product.\nA contract price always wins. Otherwise the price list discount applies, then the best volume discount, one after the other. Orders, quotes and the portal all use the same calculation, and orders already placed keep their prices.",
            fr: "La page Tarification contient trois types de règles :\n1. Listes de prix : un pourcentage de remise sur tout pour les clients de la liste (par exemple Gold, −6 %).\n2. Remises sur volume : un pourcentage à partir d'une quantité minimale, pour une catégorie ou tous les produits.\n3. Prix contractuels : un prix fixe pour un client et un produit.\nUn prix contractuel l'emporte toujours. Sinon la remise de la liste s'applique, puis la meilleure remise sur volume, l'une après l'autre. Commandes, devis et portail utilisent le même calcul, et les commandes passées gardent leurs prix.",
            ar: "تحتوي صفحة التسعير على ثلاثة أنواع من القواعد:\n1. لوائح الأسعار: نسبة تخفيض على كل المنتجات لزبناء اللائحة (مثل Gold بتخفيض 6%).\n2. تخفيضات الكمية: نسبة تخفيض ابتداءً من كمية دنيا، لفئة واحدة أو لكل المنتجات.\n3. أسعار العقد: سعر ثابت لزبون واحد ومنتج واحد.\nيفوز سعر العقد دائمًا، وإلا يُطبَّق تخفيض اللائحة ثم أفضل تخفيض للكمية تباعًا. تستعمل الطلبيات وعروض الأسعار والبوابة نفس الحساب، وتحتفظ الطلبيات السابقة بأسعارها."
        },
        keywords: { en: "price pricing discount price list volume contract special price tier gold rule", fr: "prix tarification remise liste de prix volume contrat prix spécial règle", ar: "سعر تسعير تخفيض لائحة الأسعار كمية عقد سعر خاص قاعدة" }
    },
    {
        id: "products",
        permission: "products.view",
        path: "/products",
        title: { en: "Products and categories", fr: "Produits et catégories", ar: "المنتجات والفئات" },
        body: {
            en: "Products lists the catalog with price, stock and status. Click Add product to create one: name, category, price excluding VAT, starting stock, supplier and reorder point (the stock level that triggers a reorder suggestion).\nA product that's no longer sold should be set to inactive: products used in orders can't be deleted. Categories group products for filters, reports and volume discounts.",
            fr: "Produits liste le catalogue avec prix, stock et statut. Cliquez sur Ajouter un produit : nom, catégorie, prix HT, stock initial, fournisseur et seuil de réapprovisionnement (le niveau qui déclenche une suggestion de commande).\nUn produit qui n'est plus vendu doit être rendu inactif : les produits utilisés dans des commandes ne peuvent pas être supprimés. Les catégories regroupent les produits pour les filtres, rapports et remises sur volume.",
            ar: "تعرض صفحة المنتجات الكتالوج مع السعر والمخزون والحالة. اضغط على «إضافة منتج» لإنشاء منتج: الاسم، الفئة، السعر دون ضريبة، المخزون الأولي، المورد وحد إعادة الطلب (مستوى المخزون الذي يطلق اقتراح إعادة الطلب).\nالمنتج الذي لم يعد يُباع يجب جعله غير نشط، لأن المنتجات المستعملة في الطلبيات لا يمكن حذفها. تجمع الفئات المنتجات للتصفية والتقارير وتخفيضات الكمية."
        },
        keywords: { en: "product item catalog add sku category inactive delete reorder point price", fr: "produit article catalogue ajouter catégorie inactif supprimer seuil prix", ar: "منتج سلعة كتالوج إضافة فئة غير نشط حذف حد إعادة الطلب سعر" }
    },
    {
        id: "stock",
        permission: "inventory.view",
        path: "/inventory",
        title: { en: "Stock levels and the stock ledger", fr: "Niveaux de stock et journal de stock", ar: "مستويات المخزون وسجل المخزون" },
        body: {
            en: "Stock only changes through recorded movements: sales, cancellations, deliveries, returns and manual corrections. The Stock page shows the ledger, newest first, and each product's history is under the box icon on the Products page.\nTo correct a count, open a product's stock history and click Adjust stock. Choose add or remove, the quantity and a reason. The change is recorded with your name.",
            fr: "Le stock ne change que par des mouvements enregistrés : ventes, annulations, livraisons, retours et corrections manuelles. La page Stock montre le journal, du plus récent au plus ancien, et l'historique de chaque produit est sous l'icône boîte de la page Produits.\nPour corriger un comptage, ouvrez l'historique de stock du produit et cliquez sur Ajuster le stock. Choisissez ajouter ou retirer, la quantité et un motif. La modification est enregistrée à votre nom.",
            ar: "لا يتغير المخزون إلا عبر حركات مسجلة: المبيعات، الإلغاءات، التوصلات، الإرجاعات والتصحيحات اليدوية. تعرض صفحة المخزون السجل من الأحدث إلى الأقدم، وسجل كل منتج تحت أيقونة الصندوق في صفحة المنتجات.\nلتصحيح الجرد، افتح سجل مخزون المنتج واضغط على «تعديل المخزون». اختر الإضافة أو السحب، الكمية والسبب، ويُسجَّل التغيير باسمك."
        },
        keywords: { en: "stock inventory quantity ledger movement adjust correct count lost damaged", fr: "stock inventaire quantité journal mouvement ajuster corriger comptage perdu", ar: "مخزون جرد كمية سجل حركة تعديل تصحيح ضائع تالف" }
    },
    {
        id: "reorder-suggestions",
        permission: "inventory.view",
        path: "/inventory",
        title: { en: "Reorder suggestions", fr: "Suggestions de réapprovisionnement", ar: "اقتراحات إعادة الطلب" },
        body: {
            en: "The Stock page lists products that should be reordered, grouped by supplier. A product appears when its stock plus what's already on order falls to its reorder level: the sales expected during the supplier's lead time plus safety stock, from the demand forecast. The manual reorder point is used as a minimum.\nTick the suppliers you want and click Create draft POs. You get one draft purchase order per supplier to review before placing it.",
            fr: "La page Stock liste les produits à recommander, regroupés par fournisseur. Un produit apparaît quand son stock plus ce qui est déjà commandé atteint son niveau de réapprovisionnement : les ventes prévues pendant le délai du fournisseur plus un stock de sécurité, d'après la prévision de la demande. Le seuil manuel sert de minimum.\nCochez les fournisseurs voulus et cliquez sur Créer les BC brouillons. Vous obtenez un bon de commande brouillon par fournisseur, à vérifier avant de le passer.",
            ar: "تعرض صفحة المخزون المنتجات التي يجب إعادة طلبها مجمعة حسب المورد. يظهر المنتج عندما يبلغ مخزونه مع الكميات قيد الطلب مستوى إعادة الطلب: المبيعات المتوقعة خلال مدة توريد المورد زائد مخزون الأمان، حسب توقع الطلب. ويُستعمل حد إعادة الطلب اليدوي كحد أدنى.\nحدّد الموردين واضغط على «إنشاء أوامر شراء كمسودات». تحصل على مسودة أمر شراء لكل مورد تراجعها قبل إرسالها."
        },
        keywords: { en: "reorder restock replenish low stock suggestion buy more safety stock lead time draft po", fr: "réapprovisionner recommander stock bas suggestion stock de sécurité délai bc brouillon", ar: "إعادة الطلب تموين مخزون منخفض اقتراح مخزون أمان مدة التوريد مسودة" }
    },
    {
        id: "purchase-orders",
        permission: "inventory.view",
        path: "/purchase-orders",
        title: { en: "Purchase orders and deliveries", fr: "Bons de commande et livraisons", ar: "أوامر الشراء والتوصلات" },
        body: {
            en: "Purchase orders are what you buy from suppliers.\n1. Click New purchase order, choose the supplier, add products, quantities and costs, and click Create draft.\n2. Click Place order when it's sent to the supplier. It now counts as On order.\n3. When goods arrive, click Receive into stock and enter what came. Stock goes up and the product's average cost is updated.\nOrders past their expected date show as Late.",
            fr: "Les bons de commande sont vos achats auprès des fournisseurs.\n1. Cliquez sur Nouveau bon de commande, choisissez le fournisseur, ajoutez produits, quantités et coûts, puis Créer le brouillon.\n2. Cliquez sur Passer la commande une fois envoyé au fournisseur. Il compte alors comme En commande.\n3. À l'arrivée, cliquez sur Réceptionner en stock et saisissez ce qui est arrivé. Le stock augmente et le coût moyen du produit est mis à jour.\nLes commandes dépassant leur date prévue apparaissent En retard.",
            ar: "أوامر الشراء هي مشترياتك من الموردين.\n1. اضغط على أمر شراء جديد، اختر المورد، أضف المنتجات والكميات والتكاليف، ثم «إنشاء مسودة».\n2. اضغط على «إرسال الطلب» بعد إرساله إلى المورد، فيُحتسب «قيد الطلب».\n3. عند وصول السلع اضغط على «استلام في المخزون» وأدخل ما وصل. يرتفع المخزون وتُحدَّث التكلفة المتوسطة للمنتج.\nتظهر الطلبيات التي تجاوزت تاريخها المتوقع كمتأخرة."
        },
        keywords: { en: "purchase order po supplier buy delivery receive goods arrived late cost", fr: "bon de commande achat fournisseur livraison réceptionner arrivée retard coût", ar: "أمر شراء مورد شراء توصل استلام وصول تأخر تكلفة" }
    },
    {
        id: "suppliers",
        permission: "inventory.view",
        path: "/suppliers",
        title: { en: "Suppliers and lead times", fr: "Fournisseurs et délais", ar: "الموردون ومدد التوريد" },
        body: {
            en: "Suppliers keeps contact details and the lead time: how many days a delivery usually takes. Reorder suggestions use the lead time to decide when to buy, so keep it realistic.\nSet each product's preferred supplier on the product form; suggestions are grouped by it.",
            fr: "Fournisseurs conserve les coordonnées et le délai de livraison habituel en jours. Les suggestions de réapprovisionnement utilisent ce délai pour savoir quand acheter : gardez-le réaliste.\nIndiquez le fournisseur préféré de chaque produit dans sa fiche ; les suggestions sont regroupées par fournisseur.",
            ar: "تحفظ صفحة الموردين معلومات الاتصال ومدة التوريد: عدد الأيام المعتاد للتسليم. تستعمل اقتراحات إعادة الطلب هذه المدة لتحديد وقت الشراء، فاجعلها واقعية.\nحدّد المورد المفضل لكل منتج في نموذج المنتج، وتُجمع الاقتراحات حسبه."
        },
        keywords: { en: "supplier vendor lead time delivery days contact", fr: "fournisseur délai livraison jours contact", ar: "مورد مدة التوريد أيام التسليم اتصال" }
    },
    {
        id: "reports",
        permission: "reports.view",
        path: "/reports",
        title: { en: "Sales reports and margins", fr: "Rapports de ventes et marges", ar: "تقارير المبيعات والهوامش" },
        body: {
            en: "Reports shows revenue, gross margin, orders and returns for any period, compared with the period before. The chart splits each month into cost and margin.\nThe table below breaks sales down by product, customer or category; sort any column or export it to CSV. Margins use what the goods cost when they were sold (a weighted average updated on each delivery). Amounts exclude VAT.",
            fr: "Rapports affiche chiffre d'affaires, marge brute, commandes et retours sur n'importe quelle période, comparés à la période précédente. Le graphique sépare chaque mois en coût et marge.\nLe tableau détaille les ventes par produit, client ou catégorie ; triez une colonne ou exportez en CSV. Les marges utilisent le coût des marchandises au moment de la vente (moyenne pondérée mise à jour à chaque livraison). Montants HT.",
            ar: "تعرض صفحة التقارير رقم المعاملات والهامش الإجمالي والطلبيات والإرجاعات لأي فترة، مقارنة بالفترة السابقة. يقسم الرسم كل شهر إلى تكلفة وهامش.\nيفصّل الجدول المبيعات حسب المنتج أو الزبون أو الفئة، ويمكن ترتيب أي عمود أو تصديره بصيغة CSV. تستعمل الهوامش تكلفة السلع وقت البيع (متوسط مرجح يُحدَّث مع كل توصل). المبالغ دون ضريبة."
        },
        keywords: { en: "report sales revenue margin profit cost export csv period month best customers products", fr: "rapport ventes chiffre d'affaires marge bénéfice coût export csv période", ar: "تقرير مبيعات رقم المعاملات هامش ربح تكلفة تصدير فترة" }
    },
    {
        id: "demand-forecast",
        permission: "inventory.view",
        path: "/products",
        title: { en: "The demand forecast", fr: "La prévision de la demande", ar: "توقع الطلب" },
        body: {
            en: "A model predicts how many units of each product will sell in the next 4 weeks, with an 80% range. Open a product's stock history to see its last 26 weeks of sales, the forecast and how long current stock will last.\nReorder suggestions use it. Managers can see how accurate it was on past weeks on the Demand forecast page. The model is retrained by a job that runs outside the app, usually weekly.",
            fr: "Un modèle prévoit combien d'unités de chaque produit se vendront dans les 4 prochaines semaines, avec un intervalle à 80 %. Ouvrez l'historique de stock d'un produit pour voir ses 26 dernières semaines, la prévision et la durée de couverture du stock.\nLes suggestions de réapprovisionnement l'utilisent. Les managers voient sa précision passée sur la page Prévision de la demande. Le modèle est réentraîné par une tâche hors de l'application, en général chaque semaine.",
            ar: "يتوقع نموذج عدد الوحدات التي ستُباع من كل منتج خلال الأسابيع الأربعة القادمة، مع نطاق 80%. افتح سجل مخزون المنتج لترى مبيعات آخر 26 أسبوعًا والتوقع والمدة التي سيكفي فيها المخزون.\nتستعمله اقتراحات إعادة الطلب، ويرى المسيرون دقته السابقة في صفحة توقع الطلب. يُعاد تدريب النموذج بمهمة خارج التطبيق، عادة كل أسبوع."
        },
        keywords: { en: "forecast prediction demand future sales next weeks model machine learning ai how long stock last", fr: "prévision prédiction demande ventes futures semaines modèle intelligence artificielle", ar: "توقع تنبؤ طلب مبيعات مستقبلية أسابيع نموذج ذكاء اصطناعي" }
    },
    {
        id: "recommendations",
        permission: "customers.view",
        path: "/customers",
        title: { en: "Suggested products for a customer", fr: "Produits suggérés pour un client", ar: "المنتجات المقترحة لزبون" },
        body: {
            en: "A customer's drawer lists products they haven't bought yet but probably need, with the reason: for example \"bought by 49% of customers who buy Hand Sanitizer Industrial\". Mention them on your next call or add them to a quote.\nClients with portal access see the same suggestions on their portal home page. Test results are on the Recommendations page.",
            fr: "La fiche d'un client liste des produits qu'il n'a pas encore achetés mais dont il a probablement besoin, avec la raison : par exemple « Acheté par 49 % des clients qui achètent Hand Sanitizer Industrial ». Proposez-les au prochain appel ou ajoutez-les à un devis.\nLes clients ayant accès au portail voient les mêmes suggestions sur leur page d'accueil. Les résultats de test sont sur la page Recommandations.",
            ar: "تعرض بطاقة الزبون منتجات لم يشترها بعد لكنه سيحتاجها على الأرجح، مع السبب: مثل «اشتراه 49% من الزبناء الذين يشترون Hand Sanitizer Industrial». اقترحها في المكالمة القادمة أو أضفها إلى عرض سعر.\nيرى الزبناء الذين لهم ولوج إلى البوابة نفس الاقتراحات في صفحتهم الرئيسية، ونتائج الاختبار في صفحة التوصيات."
        },
        keywords: { en: "recommend recommendation suggested products upsell cross sell what else to sell", fr: "recommandation suggestion produits suggérés vente additionnelle", ar: "توصية اقتراح منتجات مقترحة بيع إضافي" }
    },
    {
        id: "models",
        permission: "reports.view",
        path: "/forecast",
        title: { en: "How the three models are tested", fr: "Comment les trois modèles sont testés", ar: "كيف تُختبر النماذج الثلاثة" },
        body: {
            en: "The demand forecast, payment risk and recommendations each have a page under Overview with their test results. Each model is tested on past periods it never saw during training and compared with a simple rule, such as the 13-week average or the customer's past late rate. The pages show both, so you can judge whether the model is worth trusting.\nVersions lists every training run, so you can see whether accuracy changes over time.",
            fr: "La prévision de la demande, le risque de paiement et les recommandations ont chacun une page sous Vue d'ensemble avec leurs résultats de test. Chaque modèle est testé sur des périodes passées qu'il n'a jamais vues à l'entraînement et comparé à une règle simple, comme la moyenne sur 13 semaines ou le taux de retard passé du client. Les pages montrent les deux pour juger si le modèle est fiable.\nVersions liste chaque entraînement pour suivre l'évolution de la précision.",
            ar: "لكل من توقع الطلب وخطر الأداء والتوصيات صفحة تحت «نظرة عامة» بنتائج اختباره. يُختبر كل نموذج على فترات سابقة لم يرها أثناء التدريب ويُقارن بقاعدة بسيطة، مثل متوسط 13 أسبوعًا أو نسبة تأخر الزبون السابقة. تعرض الصفحات الاثنين لتحكم هل النموذج جدير بالثقة.\nتعرض «الإصدارات» كل عملية تدريب لتتابع تطور الدقة."
        },
        keywords: { en: "model accuracy test backtest machine learning ai trust baseline versions trained", fr: "modèle précision test apprentissage automatique intelligence artificielle fiabilité versions", ar: "نموذج دقة اختبار تعلم آلي ذكاء اصطناعي ثقة إصدارات" }
    },
    {
        id: "roles",
        permission: null,
        path: "/users",
        title: { en: "Roles: who can do what", fr: "Rôles : qui peut faire quoi", ar: "الأدوار: من يستطيع ماذا" },
        body: {
            en: "Every staff account has one role:\n1. Admin: everything, including users and the audit log.\n2. Manager: sales, catalog, pricing and purchasing, but not user management.\n3. Accountant: records payments and returns, sees costs, reports and the audit log; read-only elsewhere.\n4. Warehouse: stock, deliveries and moving orders along; no prices, costs or money.\n5. Employee: read-only access to sales, catalog and stock.\nIf a page or button is missing, your role doesn't include it. Ask an admin.",
            fr: "Chaque compte du personnel a un rôle :\n1. Administrateur : tout, y compris les utilisateurs et le journal d'audit.\n2. Manager : ventes, catalogue, tarification et achats, sans gestion des utilisateurs.\n3. Comptable : enregistre paiements et retours, voit coûts, rapports et journal d'audit ; lecture seule ailleurs.\n4. Magasin : stock, livraisons et avancement des commandes ; ni prix, ni coûts, ni argent.\n5. Employé : lecture seule sur les ventes, le catalogue et le stock.\nSi une page ou un bouton manque, votre rôle ne l'inclut pas. Demandez à un administrateur.",
            ar: "لكل حساب من حسابات الموظفين دور واحد:\n1. المسؤول: كل شيء، بما في ذلك المستخدمون وسجل التدقيق.\n2. المسير: المبيعات والكتالوج والتسعير والمشتريات دون تدبير المستخدمين.\n3. المحاسب: يسجل الأداءات والإرجاعات، ويرى التكاليف والتقارير وسجل التدقيق، وقراءة فقط في الباقي.\n4. أمين المخزن: المخزون والتوصلات وتحريك الطلبيات، دون أسعار أو تكاليف أو أموال.\n5. الموظف: قراءة فقط للمبيعات والكتالوج والمخزون.\nإذا غابت صفحة أو زر فدورك لا يشملهما. اسأل المسؤول."
        },
        keywords: { en: "role permission access admin manager accountant warehouse employee can't see missing button not allowed", fr: "rôle permission accès administrateur manager comptable magasin employé bouton manquant interdit", ar: "دور صلاحية ولوج مسؤول مسير محاسب أمين المخزن موظف زر غائب ممنوع" }
    },
    {
        id: "users",
        permission: "users.manage",
        path: "/users",
        title: { en: "Managing staff accounts", fr: "Gérer les comptes du personnel", ar: "تدبير حسابات الموظفين" },
        body: {
            en: "1. Open Users and click Invite user.\n2. Enter the name and email, choose a role and set a password (at least 10 characters with a letter and a number).\n3. Click Create account and give them the password.\nTo reset a password or change a role, edit the user; this signs them out everywhere. Deactivate an account when someone leaves instead of deleting it, so their history stays.",
            fr: "1. Ouvrez Utilisateurs et cliquez sur Inviter un utilisateur.\n2. Saisissez le nom et l'e-mail, choisissez un rôle et un mot de passe (au moins 10 caractères avec une lettre et un chiffre).\n3. Cliquez sur Créer le compte et transmettez le mot de passe.\nPour réinitialiser un mot de passe ou changer un rôle, modifiez l'utilisateur ; il est déconnecté partout. Désactivez le compte d'une personne qui part plutôt que de le supprimer, pour garder son historique.",
            ar: "1. افتح المستخدمين واضغط على «دعوة مستخدم».\n2. أدخل الاسم والبريد، اختر الدور وكلمة مرور (10 أحرف على الأقل بحرف ورقم).\n3. اضغط على «إنشاء الحساب» وسلّمه كلمة المرور.\nلإعادة تعيين كلمة المرور أو تغيير الدور عدّل المستخدم، فيُسجَّل خروجه من كل مكان. عطّل حساب من يغادر بدل حذفه ليبقى سجله."
        },
        keywords: { en: "user staff account invite employee password reset deactivate team member", fr: "utilisateur personnel compte inviter employé mot de passe réinitialiser désactiver", ar: "مستخدم موظف حساب دعوة كلمة مرور إعادة تعيين تعطيل" }
    },
    {
        id: "audit-log",
        permission: "audit.view",
        path: "/audit",
        title: { en: "The audit log", fr: "Le journal d'audit", ar: "سجل التدقيق" },
        body: {
            en: "The audit log records every change made in the app and every sign-in attempt: who did it, when, from which IP address, and the old and new values of edited fields. Filter by type, person or date.\nNobody can edit or delete entries. Orders and customers also show their own history in their drawers.",
            fr: "Le journal d'audit enregistre chaque modification et chaque tentative de connexion : qui, quand, depuis quelle adresse IP, et les anciennes et nouvelles valeurs. Filtrez par type, personne ou date.\nPersonne ne peut modifier ou supprimer une entrée. Les commandes et clients affichent aussi leur propre historique.",
            ar: "يسجل سجل التدقيق كل تغيير في التطبيق وكل محاولة دخول: من قام به، متى، من أي عنوان IP، والقيم القديمة والجديدة للحقول المعدّلة. صفِّ حسب النوع أو الشخص أو التاريخ.\nلا يمكن لأحد تعديل السجلات أو حذفها. وتعرض الطلبيات والزبناء أيضًا سجلهم الخاص."
        },
        keywords: { en: "audit log history who changed what trail sign in attempts security", fr: "journal audit historique qui a modifié traçabilité connexions sécurité", ar: "سجل تدقيق تاريخ من غيّر تتبع محاولات الدخول أمان" }
    }
];
