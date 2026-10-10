// Help articles for client portal accounts. Same shape as articles.staff.js.
// They only describe what a client can see and do on the portal.

module.exports = [
    {
        id: "portal-start",
        path: "/portal",
        title: { en: "Your client portal", fr: "Votre portail client", ar: "بوابتك كزبون" },
        body: {
            en: "The portal is your company's space with us. Home shows what you owe, anything past due, orders in progress, quotes waiting for your answer and products recommended for you.\nCatalog is where you order, Orders has your orders and invoices, Quotes has the offers we sent you, and Account has your details and password. You only ever see your own company's data.",
            fr: "Le portail est l'espace de votre entreprise chez nous. L'accueil montre ce que vous devez, les montants en retard, les commandes en cours, les devis en attente de réponse et des produits recommandés.\nCatalogue sert à commander, Commandes contient vos commandes et factures, Devis les offres envoyées, et Compte vos informations et votre mot de passe. Vous ne voyez que les données de votre entreprise.",
            ar: "البوابة هي فضاء شركتك لدينا. تعرض الصفحة الرئيسية ما تدين به، وما تأخر أداؤه، والطلبيات الجارية، وعروض الأسعار التي تنتظر ردك، ومنتجات مقترحة لك.\nفي الكتالوج تطلب، وفي الطلبيات طلبياتك وفواتيرك، وفي عروض الأسعار العروض المرسلة إليك، وفي الحساب معلوماتك وكلمة مرورك. لا ترى إلا بيانات شركتك."
        },
        keywords: { en: "portal home start help here features what can i do overview", fr: "portail accueil début aide que puis-je faire", ar: "بوابة الرئيسية بداية مساعدة ماذا أستطيع" }
    },
    {
        id: "portal-order",
        path: "/portal/catalog",
        title: { en: "Placing an order", fr: "Passer une commande", ar: "تقديم طلبية" },
        body: {
            en: "1. Open Catalog. Search or pick a category.\n2. Set the quantity and click Add. The cart icon at the top shows what you've added.\n3. Open the cart, check quantities and prices, and click Place order.\nYou'll see your order under Orders straight away, starting as Pending. Out-of-stock products can't be added.",
            fr: "1. Ouvrez Catalogue. Cherchez ou choisissez une catégorie.\n2. Indiquez la quantité et cliquez sur Ajouter. L'icône panier en haut montre ce que vous avez ajouté.\n3. Ouvrez le panier, vérifiez quantités et prix, puis cliquez sur Passer la commande.\nVotre commande apparaît aussitôt dans Commandes, d'abord En attente. Les produits en rupture ne peuvent pas être ajoutés.",
            ar: "1. افتح الكتالوج. ابحث أو اختر فئة.\n2. حدّد الكمية واضغط على «إضافة». تعرض أيقونة السلة في الأعلى ما أضفته.\n3. افتح السلة، تحقق من الكميات والأسعار، ثم اضغط على «تقديم الطلبية».\nتظهر طلبيتك فورًا في الطلبيات بحالة «قيد الانتظار». لا يمكن إضافة المنتجات غير المتوفرة."
        },
        keywords: { en: "order buy purchase cart basket checkout add product place order catalog", fr: "commander acheter panier ajouter produit passer commande catalogue", ar: "طلب أطلب نطلب كيف أطلب شراء أشتري سلة إضافة منتج تقديم طلبية كتالوج" }
    },
    {
        id: "portal-prices",
        path: "/portal/catalog",
        title: { en: "Your prices and volume discounts", fr: "Vos prix et remises sur volume", ar: "أسعارك وتخفيضات الكمية" },
        body: {
            en: "The catalog shows your company's price, excluding VAT. If you have a negotiated discount, the usual price is shown crossed out. Lines like \"20+: 26.33 MAD\" are cheaper prices when you order that many or more.\nInvoices add 20% VAT. Prices are confirmed when you place the order.",
            fr: "Le catalogue affiche le prix de votre entreprise, hors TVA. Si vous avez une remise négociée, le prix habituel est barré. Des lignes comme « 20+ : 26,33 MAD » indiquent un prix plus bas à partir de cette quantité.\nLes factures ajoutent 20 % de TVA. Les prix sont confirmés au moment de la commande.",
            ar: "يعرض الكتالوج سعر شركتك دون ضريبة. إذا كان لديك تخفيض متفاوض عليه، يظهر السعر العادي مشطوبًا. أسطر مثل «20+: 26,33 درهم» تعني سعرًا أقل عند طلب هذه الكمية أو أكثر.\nتضيف الفواتير ضريبة 20%، وتُؤكَّد الأسعار عند تقديم الطلبية."
        },
        keywords: { en: "price discount cheaper volume quantity vat tax ht crossed out my price", fr: "prix remise moins cher volume quantité tva ht barré mon prix", ar: "سعر تخفيض أرخص كمية ضريبة دون ضريبة مشطوب سعري" }
    },
    {
        id: "portal-invoices",
        path: "/portal/orders",
        title: { en: "Invoices and what you owe", fr: "Factures et montants dus", ar: "الفواتير وما تدين به" },
        body: {
            en: "Open Orders and click an order to see its invoice, payment status and any credit notes. You can open the invoice and print it or save it as a PDF.\nInvoices are due 30 days after the order. Home shows your open balance and warns you when something is past due. Payments are recorded by our accounts team once received; if a payment you made isn't showing yet, contact them.",
            fr: "Ouvrez Commandes et cliquez sur une commande pour voir sa facture, son statut de paiement et ses éventuels avoirs. Vous pouvez ouvrir la facture et l'imprimer ou l'enregistrer en PDF.\nLes factures sont dues 30 jours après la commande. L'accueil montre votre solde et vous avertit d'un retard. Les paiements sont enregistrés par notre comptabilité à réception ; si un paiement n'apparaît pas encore, contactez-la.",
            ar: "افتح الطلبيات واضغط على طلبية لرؤية فاتورتها وحالة أدائها والإشعارات الدائنة إن وُجدت. يمكنك فتح الفاتورة وطباعتها أو حفظها بصيغة PDF.\nتُستحق الفواتير بعد 30 يومًا من الطلبية. تعرض الصفحة الرئيسية رصيدك المفتوح وتنبهك عند وجود تأخر. تسجل مصلحة المحاسبة لدينا الأداءات عند التوصل بها، وإذا لم يظهر أداء قمت به بعد فاتصل بها."
        },
        keywords: { en: "invoice bill download pdf print pay paid owe balance overdue due date payment", fr: "facture télécharger pdf imprimer payer payé solde retard échéance paiement", ar: "فاتورة تحميل طباعة أداء مؤداة رصيد متأخر تاريخ الاستحقاق" }
    },
    {
        id: "portal-reorder",
        path: "/portal/orders",
        title: { en: "Ordering the same again", fr: "Recommander la même chose", ar: "إعادة طلب نفس المنتجات" },
        body: {
            en: "Open a past order under Orders and click Reorder. Its products go into your cart at today's prices, and anything no longer available is left out. Check the cart and click Place order.",
            fr: "Ouvrez une ancienne commande dans Commandes et cliquez sur Recommander. Ses produits vont dans votre panier aux prix du jour, sauf ceux qui ne sont plus disponibles. Vérifiez le panier et cliquez sur Passer la commande.",
            ar: "افتح طلبية سابقة في الطلبيات واضغط على «إعادة الطلب». تُضاف منتجاتها إلى سلتك بأسعار اليوم، ويُستثنى ما لم يعد متوفرًا. تحقق من السلة ثم اضغط على «تقديم الطلبية»."
        },
        keywords: { en: "reorder repeat same again previous order copy", fr: "recommander répéter même commande précédente copier", ar: "إعادة الطلب تكرار نفس الطلبية السابقة نسخ" }
    },
    {
        id: "portal-quotes",
        path: "/portal/quotes",
        title: { en: "Answering a quote", fr: "Répondre à un devis", ar: "الرد على عرض سعر" },
        body: {
            en: "Quotes lists the offers we've sent you. Open one to see the lines, prices and the date it's valid until, and print it if you need to.\nClick Accept quote to go ahead: our team then turns it into an order at the quoted prices. Click Decline quote if it isn't right. A quote can't be accepted after its validity date; ask us for a new one.",
            fr: "Devis liste les offres que nous vous avons envoyées. Ouvrez-en un pour voir les lignes, les prix et la date de validité, et imprimez-le si besoin.\nCliquez sur Accepter le devis pour donner votre accord : notre équipe le transforme en commande aux prix du devis. Cliquez sur Refuser le devis s'il ne convient pas. Un devis expiré ne peut plus être accepté ; demandez-nous-en un nouveau.",
            ar: "تعرض صفحة عروض الأسعار العروض التي أرسلناها إليك. افتح عرضًا لرؤية الأسطر والأسعار وتاريخ الصلاحية، واطبعه إن احتجت.\nاضغط على «قبول عرض السعر» للموافقة، فيحوّله فريقنا إلى طلبية بأسعار العرض. واضغط على «رفض عرض السعر» إن لم يناسبك. لا يمكن قبول عرض منتهي الصلاحية، فاطلب منا عرضًا جديدًا."
        },
        keywords: { en: "quote quotation offer accept decline reject approve validity expired devis", fr: "devis offre accepter refuser valider validité expiré", ar: "عرض سعر قبول رفض موافقة صلاحية منتهي" }
    },
    {
        id: "portal-returns",
        path: "/portal/orders",
        title: { en: "Returns and credit notes", fr: "Retours et avoirs", ar: "الإرجاعات والإشعارات الدائنة" },
        body: {
            en: "To return goods from a delivered order, contact our team with the order number and the reason. When the return is accepted, a credit note appears on that order in Orders. It lowers what you owe on the invoice, or, if you had already paid, it shows the refund. You can print each credit note.",
            fr: "Pour retourner des marchandises d'une commande livrée, contactez notre équipe avec le numéro de commande et le motif. Une fois le retour accepté, un avoir apparaît sur la commande dans Commandes. Il réduit le montant dû sur la facture ou, si vous aviez déjà payé, indique le remboursement. Chaque avoir peut être imprimé.",
            ar: "لإرجاع سلع من طلبية مُسلَّمة، اتصل بفريقنا مع رقم الطلبية والسبب. عند قبول الإرجاع، يظهر إشعار دائن على الطلبية في صفحة الطلبيات، فيخفّض المبلغ المستحق على الفاتورة أو يبيّن الاسترداد إن كنت قد أديت. يمكن طباعة كل إشعار دائن."
        },
        keywords: { en: "return refund credit note damaged defective wrong item send back", fr: "retour remboursement avoir abîmé défectueux mauvais article renvoyer", ar: "إرجاع استرداد إشعار دائن تالف معيب منتج خاطئ" }
    },
    {
        id: "portal-recommended",
        path: "/portal",
        title: { en: "Products recommended for you", fr: "Produits recommandés pour vous", ar: "منتجات مقترحة لك" },
        body: {
            en: "Recommended for you, on the home page, shows products your company hasn't ordered yet that businesses like yours often buy, at your prices. Each one says why, for example \"Bought by 49% of customers who buy Hand Sanitizer Industrial\". Click Add to put one in your cart.",
            fr: "Recommandé pour vous, sur l'accueil, montre des produits que votre entreprise n'a pas encore commandés et que des entreprises similaires achètent souvent, à vos prix. Chacun indique pourquoi, par exemple « Acheté par 49 % des clients qui achètent Hand Sanitizer Industrial ». Cliquez sur Ajouter pour le mettre au panier.",
            ar: "يعرض قسم «مقترح لك» في الصفحة الرئيسية منتجات لم تطلبها شركتك بعد وتشتريها غالبًا شركات مشابهة، بأسعارك. يذكر كل منتج السبب، مثل «اشتراه 49% من الزبناء الذين يشترون Hand Sanitizer Industrial». اضغط على «إضافة» لوضعه في السلة."
        },
        keywords: { en: "recommended suggestions why this product similar businesses", fr: "recommandé suggestions pourquoi ce produit entreprises similaires", ar: "مقترح اقتراحات لماذا هذا المنتج شركات مشابهة" }
    },
    {
        id: "portal-account",
        path: "/portal/account",
        title: { en: "Your account and password", fr: "Votre compte et mot de passe", ar: "حسابك وكلمة المرور" },
        body: {
            en: "Account shows your company details and your login. To change your password, enter the current one and the new one twice, then save. A password needs at least 10 characters with a letter and a number. Changing it signs you out on other devices.\nIf you forgot your password, ask our team to reset it. To change the company's address or contact, contact us.",
            fr: "Compte affiche les informations de votre entreprise et votre identifiant. Pour changer de mot de passe, saisissez l'actuel puis le nouveau deux fois, et enregistrez. Il faut au moins 10 caractères avec une lettre et un chiffre. Le changer vous déconnecte sur vos autres appareils.\nMot de passe oublié : demandez à notre équipe de le réinitialiser. Pour changer l'adresse ou le contact de l'entreprise, contactez-nous.",
            ar: "تعرض صفحة الحساب معلومات شركتك وبيانات دخولك. لتغيير كلمة المرور، أدخل الحالية ثم الجديدة مرتين واحفظ. يجب أن تتكون من 10 أحرف على الأقل بحرف ورقم، وتغييرها يسجّل خروجك من الأجهزة الأخرى.\nإذا نسيت كلمة المرور فاطلب من فريقنا إعادة تعيينها، ولتغيير عنوان الشركة أو جهة الاتصال اتصل بنا."
        },
        keywords: { en: "account password change forgot reset login profile address", fr: "compte mot de passe changer oublié réinitialiser connexion profil adresse", ar: "حساب كلمة المرور تغيير نسيت إعادة تعيين دخول ملف عنوان" }
    },
    {
        id: "portal-language",
        path: "/portal",
        title: { en: "Language and display", fr: "Langue et affichage", ar: "اللغة والعرض" },
        body: {
            en: "Use the globe at the top to switch between English, French and Arabic, including your printed invoices and quotes. The moon switches dark mode. Both are remembered on this device.",
            fr: "Le globe en haut change la langue (anglais, français, arabe), y compris pour les factures et devis imprimés. La lune active le mode sombre. Les deux sont mémorisés sur cet appareil.",
            ar: "استعمل رمز الكرة الأرضية في الأعلى للتبديل بين الإنجليزية والفرنسية والعربية، بما في ذلك الفواتير وعروض الأسعار المطبوعة. ويفعّل رمز القمر الوضع الداكن، ويُحفظ الاختياران على هذا الجهاز."
        },
        keywords: { en: "language french arabic english dark mode theme display", fr: "langue français arabe anglais mode sombre thème affichage", ar: "لغة فرنسية عربية إنجليزية الوضع الداكن مظهر عرض" }
    }
];
