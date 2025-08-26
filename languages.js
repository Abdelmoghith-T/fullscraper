/**
 * Language Configuration for WhatsApp Bot
 * Supports English, French, and Arabic
 */

export const languages = {
  en: {
    // Welcome and Language Selection
    welcome: "🚀 **Welcome to the Business Scraper!**\n\nPlease select your preferred language:\n\n1️⃣ **English**\n2️⃣ **Français**\n3️⃣ **العربية**\n\n💬 **Reply with the number** corresponding to your choice.",
    
    // Authentication
    auth_required: "🔐 **Authentication required.** Please send your access code first.\n\n💬 **Format:** CODE: your_code_here\n💬 **Example:** CODE: user1\n\n💡 Contact admin if you don't have an access code.\n\n0️⃣ **CHANGE LANGUAGE** - Select a different language",
    invalid_code: "❌ Invalid access code. Please contact admin for a valid code.",
    access_granted: "✅ **Access granted!** Welcome to the Business Scraper.\n\n📝 Send a search query (e.g., \"restaurant casablanca\").\n\n📅 **Daily Limits:** You can perform 4 scraping jobs per day. Limits reset at midnight.\n\n💡 Use STATUS command to check your remaining scrapings.",
    
    // Main Menu
    main_menu: "🏠 **Main Menu**\n\nWhat would you like to do?\n\n1️⃣ **🚀 START SCRAPER** - Begin a new scraping job\n2️⃣ **📊 VIEW HISTORY** - See your previous scraping results\n3️⃣ **📈 STATUS** - Check your account status and daily limits\n4️⃣ **🌐 CHANGE LANGUAGE** - Switch to a different language\n5️⃣ **🔓 LOGOUT** - Sign out and switch accounts\n\n💬 **Reply with the number** corresponding to your choice.",
    language_changed: "🌐 **Language changed successfully!**\n\nYour language preference has been updated and saved to your profile.\n\n💡 **Tip:** This setting will be remembered for future sessions.",
    no_history: "📊 **No Scraping History**\n\nYou haven't completed any scraping jobs yet.\n\n🚀 **Get started:** Choose option 1 to begin your first scraping job!",
    history_header: "📊 **Your Scraping History**\n\nHere are your recent scraping jobs:",
    
    // Search Flow
    enter_niche: "🎯 **Enter your search query:**\n\n💬 **Examples:**\n• dentist casablanca\n• restaurant marrakech\n• web developer fes\n\n💡 **Tip:** Include location for better results\n\n0️⃣ **BACK TO MENU** - Return to main menu",
    invalid_niche: "⚠️ Please send your search query (e.g., \"dentist casablanca\").",
    
    // Source Selection
    select_source: "🎯 **Select Data Source for \"{niche}\":**\n\n1️⃣ **GOOGLE** - Business websites & contact pages\n2️⃣ **LINKEDIN** - Professional profiles & companies\n3️⃣ **MAPS** - Business directory & local listings\n4️⃣ **ALL** - Combined multi-source scraping\n\n0️⃣ **BACK** - Go back to niche input\n0️⃣0️⃣ **RESTART** - Start a new search\n\n💬 **Reply with the number** corresponding to your choice.",
    
    // Data Type Selection
    select_type_google: "📋 **Select Data Type for Google Search:**\n\n1️⃣ **EMAILS** - Extract email addresses only\n2️⃣ **PHONES** - Extract phone numbers only\n3️⃣ **CONTACTS** - Both emails and phones\n\n0️⃣ **BACK** - Go back to source selection\n0️⃣0️⃣ **RESTART** - Start a new search\n\n💬 **Reply with the number** corresponding to your choice.",
    select_type_linkedin: "📋 **Select Data Type for LinkedIn:**\n\n1️⃣ **PROFILES** - Professional profiles only\n2️⃣ **CONTACTS** - Contact information (emails/phones)\n3️⃣ **COMPLETE** - Complete profile data\n\n0️⃣ **BACK** - Go back to source selection\n0️⃣0️⃣ **RESTART** - Start a new search\n\n💬 **Reply with the number** corresponding to your choice.",
    select_type_maps: "📋 **Select Data Type for Google Maps:**\n\n1️⃣ **PROFILES** - Business profiles with addresses\n2️⃣ **CONTACTS** - Contact information (emails/phones)\n3️⃣ **COMPLETE** - Complete business data\n\n0️⃣ **BACK** - Go back to source selection\n0️⃣0️⃣ **RESTART** - Start a new search\n\n💬 **Reply with the number** corresponding to your choice.",
    select_type_all: "📋 **Select Data Type for All Sources:**\n\n1️⃣ **CONTACTS** - Contact information from all sources\n2️⃣ **COMPLETE** - Complete data from all sources\n\n0️⃣ **BACK** - Go back to source selection\n0️⃣0️⃣ **RESTART** - Start a new search\n\n💬 **Reply with the number** corresponding to your choice.",
    
    // Format Selection
    select_format: "💾 **Select Output Format:**\n\n1️⃣ **XLSX** - Excel file (recommended)\n2️⃣ **CSV** - Comma-separated values\n3️⃣ **JSON** - JavaScript Object Notation\n\n0️⃣ **BACK** - Go back to data type selection\n0️⃣0️⃣ **RESTART** - Start a new search\n\n💬 **Reply with the number** corresponding to your choice.",
    select_format_google: "💾 **Google Search only supports TXT format**\n\n1️⃣ **TXT** - Text file\n\n0️⃣ **BACK** - Go back to data type selection\n0️⃣0️⃣ **RESTART** - Start a new search\n\n💬 **Reply with the number** corresponding to your choice.",
    select_format_linkedin: "💾 **LinkedIn only supports XLSX format**\n\n1️⃣ **XLSX** - Excel file\n\n0️⃣ **BACK** - Go back to data type selection\n0️⃣0️⃣ **RESTART** - Start a new search\n\n💬 **Reply with the number** corresponding to your choice.",
    select_format_maps: "💾 **Select Output Format for Google Maps:**\n\n1️⃣ **JSON** - Native Google Maps format\n2️⃣ **XLSX** - Excel file\n\n0️⃣ **BACK** - Go back to data type selection\n0️⃣0️⃣ **RESTART** - Start a new search\n\n💬 **Reply with the number** corresponding to your choice.",
    select_format_all: "💾 **Select Output Format for All Sources:**\n\n1️⃣ **XLSX** - Recommended for combined data\n2️⃣ **CSV** - Universal format\n3️⃣ **JSON** - Developer format\n\n0️⃣ **BACK** - Go back to data type selection\n0️⃣0️⃣ **RESTART** - Start a new search\n\n💬 **Reply with the number** corresponding to your choice.",
    format_set: "💾 **Output format set to: {format}**\n\n🚀 **Ready to start scraping!**\n\n0️⃣ **BACK** - Go back to format selection\n0️⃣0️⃣ **RESTART** - Start a new search\n\n💬 **Send:** START",
    
    // Configuration Commands
    source_set: "🎯 Data source set to: {source}",
    //format_set: "💾 Output format set to: {format}",
    limit_set: "📏 Result limit set to: {limit}",
    settings_updated: "✅ Settings updated successfully!",
    
    // Job Management
    job_starting: "🔍 **Starting scraping job...**\n\n📋 **Job Details:**\n• Niche: \"{niche}\"\n• Source: {source}\n• Format: {format}\n• Limit: {limit}\n\n⏱️ **Progress updates will be sent automatically.**",
    job_complete: "✅ **Scraping Complete!**\n\n📊 **Results Summary:**\n• Total Results: {total}\n• Emails: {emails}\n• Phones: {phones}\n• Websites: {websites}\n\n💾 **File ready for download** ⬇️",
    job_stopped: "🛑 **Scraping job stopped.**",
    job_status: "📊 **Current Job Status:** {status}",
    
    // Navigation
    go_back: "↩️ Please enter your new search niche.",
    restart: "🔄 **Restarted!** Please send your new search niche (e.g., \"dentist casablanca\").",
    reset: "♻️ **Preferences reset to defaults.**",
    
    // Help
    help: "📚 **Business Scraper Help**\n\n🔐 **CODE: <code>**\n   Authenticate with your access code\n   Example: \"CODE: user1\"\n\n🎯 **SOURCE: <source>**\n   Set data source: GOOGLE, LINKEDIN, MAPS, ALL\n\n💾 **FORMAT: <format>**\n   Set output format: XLSX, CSV, JSON\n\n📏 **LIMIT: <number>**\n   Set max results (1-500). Default: 300\n\n📊 **STATUS**\n   Check current job status\n\n🛑 **STOP**\n   Cancel current scraping job\n\n♻️ **RESET**\n   Reset all preferences\n\n🔄 **RESTART** (00)\n   Restart the entire process from niche selection\n\n❓ **HELP**\n   Show this help message\n\n💡 **Getting Started:**\n1. Get your access code from admin\n2. Send: CODE: your_code_here\n3. Send your search query (e.g., \"restaurant casablanca\")\n4. Follow the numbered prompts to configure source, type, and format.\n5. Send: START to begin scraping\n6. Receive real-time progress updates!\n\n**Navigation Tip:** At any numbered selection step, reply with `0` to go back to the previous step.",
    
    // Progress Messages
    progress_update: "⏱️ **Progress Update:** {message}",
    progress_complete: "Progress: 100% — Scraping complete!",
    
    // Errors
    error_generic: "❌ An error occurred. Please try again.",
    error_no_results: "📈 **Results Summary:**\n\n📊 **Total Results: 0**\n\n💡 **No results to save** - try running longer or adjust search terms",
    invalid_selection: "⚠️ Invalid selection. Please choose a number between 1 and {max} or 0 to go back.",
    
    // File Messages
    file_ready: "📎 **File ready for download:**\n{filename}"
  },
  
  fr: {
    // Welcome and Language Selection
    welcome: "🚀 **Bienvenue dans le Scraper Business!**\n\nVeuillez sélectionner votre langue préférée:\n\n1️⃣ **English**\n2️⃣ **Français**\n3️⃣ **العربية**\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
    
    // Authentication
    auth_required: "🔐 **Authentification requise.** Veuillez d'abord envoyer votre code d'accès.\n\n💬 **Format:** CODE: votre_code_ici\n💬 **Exemple:** CODE: user1\n\n💡 Contactez l'administrateur si vous n'avez pas de code d'accès.\n\n0️⃣ **CHANGER DE LANGUE** - Sélectionner une langue différente",
    invalid_code: "❌ Code d'accès invalide. Veuillez contacter l'administrateur pour un code valide.",
    access_granted: "✅ **Accès accordé!** Bienvenue dans le Scraper Business.\n\n📝 Envoyez une requête de recherche (ex: \"restaurant casablanca\").\n\n📅 **Limites Quotidiennes:** Vous pouvez effectuer 4 jobs de scraping par jour. Les limites se réinitialisent à minuit.\n\n💡 Utilisez la commande STATUS pour vérifier vos scrapings restants.",
    
    // Main Menu
    main_menu: "🏠 **Menu Principal**\n\nQue souhaitez-vous faire?\n\n1️⃣ **🚀 DÉMARRER LE SCRAPER** - Commencer un nouveau job de scraping\n2️⃣ **📊 VOIR L'HISTORIQUE** - Voir vos résultats de scraping précédents\n3️⃣ **📈 STATUT** - Vérifier votre statut de compte et vos limites quotidiennes\n4️⃣ **🌐 CHANGER LA LANGUE** - Passer à une autre langue\n5️⃣ **🔓 DÉCONNEXION** - Se déconnecter et changer de compte\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
    language_changed: "🌐 **Langue changée avec succès!**\n\nVotre préférence de langue a été mise à jour et enregistrée dans votre profil.\n\n💡 **Conseil:** Ce paramètre sera conservé pour les sessions futures.",
    no_history: "📊 **Aucun Historique de Scraping**\n\nVous n'avez pas encore effectué de jobs de scraping.\n\n🚀 **Commencez:** Choisissez l'option 1 pour commencer votre premier job de scraping!",
    history_header: "📊 **Votre Historique de Scraping**\n\nVoici vos derniers jobs de scraping:",
    
    // Search Flow
    enter_niche: "🎯 **Entrez votre requête de recherche:**\n\n💬 **Exemples:**\n• dentiste casablanca\n• restaurant marrakech\n• développeur web fes\n\n💡 **Conseil:** Incluez la localisation pour de meilleurs résultats\n\n0️⃣ **RETOUR AU MENU** - Retourner au menu principal",
    invalid_niche: "⚠️ Veuillez envoyer votre requête de recherche (ex: \"dentiste casablanca\").",
    
    // Source Selection
    select_source: "🎯 **Sélectionnez la Source de Données pour \"{niche}\":**\n\n1️⃣ **GOOGLE** - Sites web d'entreprises et pages de contact\n2️⃣ **LINKEDIN** - Profils professionnels et entreprises\n3️⃣ **MAPS** - Annuaire d'entreprises et listes locales\n4️⃣ **ALL** - Scraping multi-sources combiné\n\n0️⃣ **RETOUR** - Retour à la saisie de niche\n0️⃣0️⃣ **REDÉMARRER** - Commencer une nouvelle recherche\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
    
    // Data Type Selection
    select_type_google: "📋 **Sélectionnez le Type de Données pour Google Search:**\n\n1️⃣ **EMAILS** - Extraire uniquement les adresses email\n2️⃣ **PHONES** - Extraire uniquement les numéros de téléphone\n3️⃣ **CONTACTS** - Emails et téléphones\n\n0️⃣ **RETOUR** - Retour à la sélection de source\n0️⃣0️⃣ **REDÉMARRER** - Commencer une nouvelle recherche\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
    select_type_linkedin: "📋 **Sélectionnez le Type de Données pour LinkedIn:**\n\n1️⃣ **PROFILES** - Profils professionnels uniquement\n2️⃣ **CONTACTS** - Informations de contact (emails/téléphones)\n3️⃣ **COMPLETE** - Données de profil complètes\n\n0️⃣ **RETOUR** - Retour à la sélection de source\n0️⃣0️⃣ **REDÉMARRER** - Commencer une nouvelle recherche\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
    select_type_maps: "📋 **Sélectionnez le Type de Données pour Google Maps:**\n\n1️⃣ **PROFILES** - Profils d'entreprises avec adresses\n2️⃣ **CONTACTS** - Informations de contact (emails/téléphones)\n3️⃣ **COMPLETE** - Données d'entreprise complètes\n\n0️⃣ **RETOUR** - Retour à la sélection de source\n0️⃣0️⃣ **REDÉMARRER** - Commencer une nouvelle recherche\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
    select_type_all: "📋 **Sélectionnez le Type de Données pour Toutes les Sources:**\n\n1️⃣ **CONTACTS** - Informations de contact de toutes les sources\n2️⃣ **COMPLETE** - Données complètes de toutes les sources\n\n0️⃣ **RETOUR** - Retour à la sélection de source\n0️⃣0️⃣ **REDÉMARRER** - Commencer une nouvelle recherche\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
    
    // Format Selection
    select_format: "💾 **Sélectionnez le Format de Sortie:**\n\n1️⃣ **XLSX** - Fichier Excel (recommandé)\n2️⃣ **CSV** - Valeurs séparées par des virgules\n3️⃣ **JSON** - Notation d'objet JavaScript\n\n0️⃣ **RETOUR** - Retour à la sélection de type de données\n0️⃣0️⃣ **REDÉMARRER** - Commencer une nouvelle recherche\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
    select_format_google: "💾 **Google Search ne supporte que le format TXT**\n\n1️⃣ **TXT** - Fichier texte\n\n0️⃣ **RETOUR** - Retour à la sélection de type de données\n0️⃣0️⃣ **REDÉMARRER** - Commencer une nouvelle recherche\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
    select_format_linkedin: "💾 **LinkedIn ne supporte que le format XLSX**\n\n1️⃣ **XLSX** - Fichier Excel\n\n0️⃣ **RETOUR** - Retour à la sélection de type de données\n0️⃣0️⃣ **REDÉMARRER** - Commencer une nouvelle recherche\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
    select_format_maps: "💾 **Sélectionnez le Format de Sortie pour Google Maps:**\n\n1️⃣ **JSON** - Format natif Google Maps\n2️⃣ **XLSX** - Fichier Excel\n\n0️⃣ **RETOUR** - Retour à la sélection de type de données\n0️⃣0️⃣ **REDÉMARRER** - Commencer une nouvelle recherche\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
    select_format_all: "💾 **Sélectionnez le Format de Sortie pour Toutes les Sources:**\n\n1️⃣ **XLSX** - Recommandé pour les données combinées\n2️⃣ **CSV** - Format universel\n3️⃣ **JSON** - Format développeur\n\n0️⃣ **RETOUR** - Retour à la sélection de type de données\n0️⃣0️⃣ **REDÉMARRER** - Commencer une nouvelle recherche\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
    format_set: "💾 **Format de sortie défini sur: {format}**\n\n🚀 **Prêt à commencer le scraping!**\n\n0️⃣ **RETOUR** - Retour à la sélection de format\n0️⃣0️⃣ **REDÉMARRER** - Commencer une nouvelle recherche\n\n💬 **Envoyez:** START",
    
    // Configuration Commands
    source_set: "🎯 Source de données définie sur: {source}",
    //format_set: "💾 Format de sortie défini sur: {format}",
    limit_set: "📏 Limite de résultats définie sur: {limit}",
    settings_updated: "✅ Paramètres mis à jour avec succès!",
    
    // Job Management
    job_starting: "🔍 **Démarrage du job de scraping...**\n\n📋 **Détails du Job:**\n• Niche: \"{niche}\"\n• Source: {source}\n• Format: {format}\n• Limite: {limit}\n\n⏱️ **Les mises à jour de progression seront envoyées automatiquement.**",
    job_complete: "✅ **Scraping Terminé!**\n\n📊 **Résumé des Résultats:**\n• Total des Résultats: {total}\n• Emails: {emails}\n• Téléphones: {phones}\n• Sites Web: {websites}\n\n💾 **Fichier prêt pour téléchargement** ⬇️",
    job_stopped: "🛑 **Job de scraping arrêté.**",
    job_status: "📊 **Statut Actuel du Job:** {status}",
    
    // Navigation
    go_back: "↩️ Veuillez entrer votre nouvelle niche de recherche.",
    restart: "🔄 **Redémarré!** Veuillez envoyer votre nouvelle niche de recherche (ex: \"dentiste casablanca\").",
    reset: "♻️ **Préférences remises aux valeurs par défaut.**",
    
    // Help
    help: "📚 **Aide du Scraper Business**\n\n🔐 **CODE: <code>**\n   Authentifiez-vous avec votre code d'accès\n   Exemple: \"CODE: user1\"\n\n🎯 **SOURCE: <source>**\n   Définir la source de données: GOOGLE, LINKEDIN, MAPS, ALL\n\n💾 **FORMAT: <format>**\n   Définir le format de sortie: XLSX, CSV, JSON\n\n📏 **LIMIT: <number>**\n   Définir le nombre max de résultats (1-500). Par défaut: 300\n\n📊 **STATUS**\n   Vérifier le statut actuel du job\n\n🛑 **STOP**\n   Annuler le job de scraping actuel\n\n♻️ **RESET**\n   Remettre toutes les préférences aux valeurs par défaut\n\n🔄 **RESTART** (00)\n   Redémarrer tout le processus depuis la sélection de niche\n\n❓ **HELP**\n   Afficher ce message d'aide\n\n💡 **Pour Commencer:**\n1. Obtenez votre code d'accès de l'administrateur\n2. Envoyez: CODE: votre_code_ici\n3. Envoyez votre requête de recherche (ex: \"restaurant casablanca\")\n4. Suivez les invites numérotées pour configurer la source, le type et le format.\n5. Envoyez: START pour commencer le scraping\n6. Recevez les mises à jour de progression en temps réel!\n\n**Conseil de Navigation:** À toute étape de sélection numérotée, répondez avec `0` pour revenir à l'étape précédente.",
    
    // Progress Messages
    progress_update: "⏱️ **Mise à Jour de Progression:** {message}",
    progress_complete: "Progression: 100% — Scraping terminé!",
    
    // Errors
    error_generic: "❌ Une erreur s'est produite. Veuillez réessayer.",
    error_no_results: "📈 **Résumé des Résultats:**\n\n📊 **Total des Résultats: 0**\n\n💡 **Aucun résultat à sauvegarder** - essayez de lancer plus longtemps ou ajustez les termes de recherche",
    invalid_selection: "⚠️ Sélection invalide. Veuillez choisir un numéro entre 1 et {max} ou 0 pour revenir en arrière.",
    
    // File Messages
    file_ready: "📎 **Fichier prêt pour téléchargement:**\n{filename}"
  },
  
  ar: {
    // Welcome and Language Selection
    welcome: "🚀 **مرحباً بك في مستخرج البيانات التجارية!**\n\nيرجى اختيار لغتك المفضلة:\n\n1️⃣ **English**\n2️⃣ **Français**\n3️⃣ **العربية**\n\n💬 **أرسل الرقم** المقابل لاختيارك.",
    
    // Authentication
    auth_required: "🔐 **مطلوب مصادقة.** يرجى إرسال رمز الوصول أولاً.\n\n💬 **التنسيق:** CODE: رمزك_هنا\n💬 **مثال:** CODE: user1\n\n💡 اتصل بالمدير إذا لم يكن لديك رمز وصول.\n\n0️⃣ **تغيير اللغة** - اختر لغة مختلفة",
    invalid_code: "❌ رمز وصول غير صحيح. يرجى الاتصال بالمدير للحصول على رمز صحيح.",
    access_granted: "✅ **تم منح الوصول!** مرحباً بك في مستخرج البيانات التجارية.\n\n📝 أرسل استعلام بحث (مثال: \"مطعم الدار البيضاء\").\n\n📅 **الحدود اليومية:** يمكنك أداء 4 مهام استخراج يومياً. يتم إعادة تعيين الحدود عند منتصف الليل.\n\n💡 استخدم أمر STATUS للتحقق من عمليات الاستخراج المتبقية.",
    
    // Main Menu
    main_menu: "🏠 **قائمة الصفحة الرئيسية**\n\nماذا تريد أن تفعل؟\n\n1️⃣ **🚀 بدء مستخرج البيانات** - بدء مهمة استخراج جديدة\n2️⃣ **📊 عرض التاريخ** - عرض نتائج الاستخراج السابقة\n3️⃣ **📈 الحالة** - التحقق من حالة الحساب والحدود اليومية\n4️⃣ **🌐 تغيير اللغة** - تغيير اللغة المفضلة\n5️⃣ **🔓 تسجيل الخروج** - تسجيل الخروج وتغيير الحساب\n\n💬 **أرسل الرقم** المقابل لاختيارك.",
    language_changed: "�� **تم تغيير اللغة بنجاح!**\n\nتم تحديث تفضيل اللغة وحفظه في ملف الملف الشخصي.\n\n💡 **نصيحة:** سيتم تذكر هذه الإعداد للجلسات القادمة.",
    no_history: "📊 **لا يوجد تاريخ استخراج البيانات**\n\nلم تكن قد أكملت أي مهام استخراج بعد.\n\n🚀 **ابدأ:** اختر الخيار 1 لبدء أول مهمة استخراج لك!",
    history_header: "📊 **تاريخ استخراج البيانات الخاص بك**\n\nهذه هي آخر مهام استخراج البيانات الخاصة بك:",
    
    // Search Flow
    enter_niche: "🎯 **أدخل استعلام البحث الخاص بك:**\n\n💬 **أمثلة:**\n• طبيب أسنان الدار البيضاء\n• مطعم مراكش\n• مطور ويب فاس\n\n💡 **نصيحة:** أضف الموقع للحصول على نتائج أفضل\n\n0️⃣ **العودة إلى القائمة** - العودة إلى القائمة الرئيسية",
    invalid_niche: "⚠️ يرجى إرسال استعلام البحث الخاص بك (مثال: \"طبيب أسنان الدار البيضاء\").",
    
    // Source Selection
    select_source: "🎯 **اختر مصدر البيانات لـ \"{niche}\":**\n\n1️⃣ **GOOGLE** - مواقع الويب التجارية وصفحات الاتصال\n2️⃣ **LINKEDIN** - الملفات الشخصية المهنية والشركات\n3️⃣ **MAPS** - دليل الأعمال والقوائم المحلية\n4️⃣ **ALL** - استخراج متعدد المصادر مجتمع\n\n0️⃣ **رجوع** - العودة لإدخال النيش\n0️⃣0️⃣ **إعادة تشغيل** - بدء بحث جديد\n\n💬 **أرسل الرقم** المقابل لاختيارك.",
    
    // Data Type Selection
    select_type_google: "📋 **اختر نوع البيانات لبحث Google:**\n\n1️⃣ **EMAILS** - استخراج عناوين البريد الإلكتروني فقط\n2️⃣ **PHONES** - استخراج أرقام الهاتف فقط\n3️⃣ **CONTACTS** - البريد الإلكتروني والهاتف معاً\n\n0️⃣ **رجوع** - العودة لاختيار المصدر\n0️⃣0️⃣ **إعادة تشغيل** - بدء بحث جديد\n\n💬 **أرسل الرقم** المقابل لاختيارك.",
    select_type_linkedin: "📋 **اختر نوع البيانات لـ LinkedIn:**\n\n1️⃣ **PROFILES** - الملفات الشخصية المهنية فقط\n2️⃣ **CONTACTS** - معلومات الاتصال (بريد إلكتروني/هاتف)\n3️⃣ **COMPLETE** - بيانات الملف الشخصي الكاملة\n\n0️⃣ **رجوع** - العودة لاختيار المصدر\n0️⃣0️⃣ **إعادة تشغيل** - بدء بحث جديد\n\n💬 **أرسل الرقم** المقابل لاختيارك.",
    select_type_maps: "📋 **اختر نوع البيانات لخرائط Google:**\n\n1️⃣ **PROFILES** - ملفات الأعمال مع العناوين\n2️⃣ **CONTACTS** - معلومات الاتصال (بريد إلكتروني/هاتف)\n3️⃣ **COMPLETE** - بيانات الأعمال الكاملة\n\n0️⃣ **رجوع** - العودة لاختيار المصدر\n0️⃣0️⃣ **إعادة تشغيل** - بدء بحث جديد\n\n💬 **أرسل الرقم** المقابل لاختيارك.",
    select_type_all: "📋 **اختر نوع البيانات لجميع المصادر:**\n\n1️⃣ **CONTACTS** - معلومات الاتصال من جميع المصادر\n2️⃣ **COMPLETE** - البيانات الكاملة من جميع المصادر\n\n0️⃣ **رجوع** - العودة لاختيار المصدر\n0️⃣0️⃣ **إعادة تشغيل** - بدء بحث جديد\n\n💬 **أرسل الرقم** المقابل لاختيارك.",
    
    // Format Selection
    select_format: "💾 **اختر تنسيق الإخراج:**\n\n1️⃣ **XLSX** - ملف Excel (موصى به)\n2️⃣ **CSV** - قيم مفصولة بفواصل\n3️⃣ **JSON** - تدوين كائن JavaScript\n\n0️⃣ **رجوع** - العودة لاختيار نوع البيانات\n0️⃣0️⃣ **إعادة تشغيل** - بدء بحث جديد\n\n💬 **أرسل الرقم** المقابل لاختيارك.",
    select_format_google: "💾 **بحث Google يدعم فقط تنسيق TXT**\n\n1️⃣ **TXT** - ملف نصي\n\n0️⃣ **رجوع** - العودة لاختيار نوع البيانات\n0️⃣0️⃣ **إعادة تشغيل** - بدء بحث جديد\n\n💬 **أرسل الرقم** المقابل لاختيارك.",
    select_format_linkedin: "💾 **LinkedIn يدعم فقط تنسيق XLSX**\n\n1️⃣ **XLSX** - ملف Excel\n\n0️⃣ **رجوع** - العودة لاختيار نوع البيانات\n0️⃣0️⃣ **إعادة تشغيل** - بدء بحث جديد\n\n💬 **أرسل الرقم** المقابل لاختيارك.",
    select_format_maps: "💾 **اختر تنسيق الإخراج لخرائط Google:**\n\n1️⃣ **JSON** - تنسيق خرائط Google الأصلي\n2️⃣ **XLSX** - ملف Excel\n\n0️⃣ **رجوع** - العودة لاختيار نوع البيانات\n0️⃣0️⃣ **إعادة تشغيل** - بدء بحث جديد\n\n💬 **أرسل الرقم** المقابل لاختيارك.",
    select_format_all: "💾 **اختر تنسيق الإخراج لجميع المصادر:**\n\n1️⃣ **XLSX** - موصى به للبيانات المجمعة\n2️⃣ **CSV** - تنسيق عالمي\n3️⃣ **JSON** - تنسيق المطور\n\n0️⃣ **رجوع** - العودة لاختيار نوع البيانات\n0️⃣0️⃣ **إعادة تشغيل** - بدء بحث جديد\n\n💬 **أرسل الرقم** المقابل لاختيارك.",
    format_set: "💾 **تم تعيين تنسيق الإخراج على: {format}**\n\n🚀 **جاهز لبدء الاستخراج!**\n\n0️⃣ **رجوع** - العودة لاختيار التنسيق\n0️⃣0️⃣ **إعادة تشغيل** - بدء بحث جديد\n\n💬 **أرسل:** START",
    
    // Configuration Commands
    source_set: "🎯 تم تعيين مصدر البيانات على: {source}",
    //format_set: "💾 تم تعيين تنسيق الإخراج على: {format}",
    limit_set: "📏 تم تعيين حد النتائج على: {limit}",
    settings_updated: "✅ تم تحديث الإعدادات بنجاح!",
    
    // Job Management
    job_starting: "🔍 **بدء مهمة الاستخراج...**\n\n📋 **تفاصيل المهمة:**\n• النيش: \"{niche}\"\n• المصدر: {source}\n• التنسيق: {format}\n• الحد: {limit}\n\n⏱️ **سيتم إرسال تحديثات التقدم تلقائياً.**",
    job_complete: "✅ **اكتمل الاستخراج!**\n\n📊 **ملخص النتائج:**\n• إجمالي النتائج: {total}\n• البريد الإلكتروني: {emails}\n• الهاتف: {phones}\n• مواقع الويب: {websites}\n\n💾 **الملف جاهز للتحميل** ⬇️",
    job_stopped: "🛑 **تم إيقاف مهمة الاستخراج.**",
    job_status: "📊 **حالة المهمة الحالية:** {status}",
    
    // Navigation
    go_back: "↩️ يرجى إدخال نيش البحث الجديد الخاص بك.",
    restart: "🔄 **تم إعادة التشغيل!** يرجى إرسال نيش البحث الجديد الخاص بك (مثال: \"طبيب أسنان الدار البيضاء\").",
    reset: "♻️ **تم إعادة تعيين التفضيلات إلى القيم الافتراضية.**",
    
    // Help
    help: "📚 **مساعدة مستخرج البيانات التجارية**\n\n🔐 **CODE: <code>**\n   المصادقة برمز الوصول الخاص بك\n   مثال: \"CODE: user1\"\n\n🎯 **SOURCE: <source>**\n   تعيين مصدر البيانات: GOOGLE, LINKEDIN, MAPS, ALL\n\n💾 **FORMAT: <format>**\n   تعيين تنسيق الإخراج: XLSX, CSV, JSON\n\n📏 **LIMIT: <number>**\n   تعيين الحد الأقصى للنتائج (1-500). الافتراضي: 300\n\n📊 **STATUS**\n   التحقق من حالة المهمة الحالية\n\n🛑 **STOP**\n   إلغاء مهمة الاستخراج الحالية\n\n♻️ **RESET**\n   إعادة تعيين جميع التفضيلات\n\n🔄 **RESTART** (00)\n   إعادة تشغيل العملية بالكامل من اختيار النيش\n\n❓ **HELP**\n   عرض رسالة المساعدة هذه\n\n💡 **للبدء:**\n1. احصل على رمز الوصول من المدير\n2. أرسل: CODE: رمزك_هنا\n3. أرسل استعلام البحث الخاص بك (مثال: \"مطعم الدار البيضاء\")\n4. اتبع المطالبات المرقمة لتكوين المصدر والنوع والتنسيق.\n5. أرسل: START لبدء الاستخراج\n6. استلم تحديثات التقدم في الوقت الفعلي!\n\n**نصيحة التنقل:** في أي خطوة اختيار مرقمة، أرسل `0` للعودة إلى الخطوة السابقة.",
    
    // Progress Messages
    progress_update: "⏱️ **تحديث التقدم:** {message}",
    progress_complete: "التقدم: 100% — اكتمل الاستخراج!",
    
    // Errors
    error_generic: "❌ حدث خطأ. يرجى المحاولة مرة أخرى.",
    error_no_results: "📈 **ملخص النتائج:**\n\n📊 **إجمالي النتائج: 0**\n\n💡 **لا توجد نتائج للحفظ** - جرب التشغيل لفترة أطول أو اضبط مصطلحات البحث",
    invalid_selection: "⚠️ اختيار غير صحيح. يرجى اختيار رقم بين 1 و {max} أو 0 للرجوع.",
    
    // File Messages
    file_ready: "📎 **الملف جاهز للتحميل:**\n{filename}"
  }
};

/**
 * Get localized message
 * @param {string} lang - Language code (en, fr, ar)
 * @param {string} key - Message key
 * @param {Object} params - Parameters to replace in message
 * @returns {string} Localized message
 */
export function getMessage(lang, key, params = {}) {
  const messages = languages[lang] || languages.en;
  let message = messages[key] || languages.en[key] || key;
  
  // Replace parameters in message
  Object.entries(params).forEach(([param, value]) => {
    message = message.replace(new RegExp(`{${param}}`, 'g'), value);
  });
  
  return message;
}

/**
 * Get available languages
 * @returns {Array} Array of language objects
 */
export function getAvailableLanguages() {
  return [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' }
  ];
}
