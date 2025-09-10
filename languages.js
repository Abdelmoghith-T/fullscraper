/**
 * Language Configuration for WhatsApp Bot
 * Supports English, French, and Arabic
 */

export const languages = {
  en: {
    // Welcome and Language Selection
    welcome: "🤖 **Welcome to the Business Lead Finder!**\n\nPlease select your preferred language:\n\n1️⃣ **English**\n2️⃣ **Français**\n3️⃣ **العربية**\n\n💬 **Reply with the number** corresponding to your choice.",
    language_selection: "🌐 **Language Selection**\n\nPlease select your preferred language:\n\n1️⃣ **English**\n2️⃣ **Français**\n3️⃣ **العربية**\n\n💬 **Reply with the number** corresponding to your choice.\n\n0️⃣ **BACK TO MENU** - Return to main menu",
    
    // Authentication
    auth_required: "🔐 **Authentication required.** Please send your access code first.\n\n💬 **Format:** CODE: your_code_here\n💬 **Example:** CODE: user1\n\n💡 Contact admin if you don't have an access code.\n\n0️⃣ **CHANGE LANGUAGE** - Select a different language",
    invalid_code: "❌ Invalid access code. Please contact admin for a valid code.",
    access_granted: "✅ **Access granted!** Welcome to the Business Lead Finder.\n\n📝 Send a search query (e.g., \"restaurant casablanca\").\n\n📅 **Daily Limits:** You can perform 4 lead searches per day. Limits reset at midnight.\n\n💡 Use STATUS command to check your remaining searches.",
    
    // Main Menu
    main_menu: "🏠 **Main Menu**\n\nWhat would you like to do?\n\n1️⃣ **🚀 START LEAD FINDER** - Start a new lead‑finding session\n2️⃣ **📈 STATUS** - Check your account status and daily limits\n3️⃣ **📚 USER GUIDE** - Download complete user guide (PDF)\n4️⃣ **🌐 CHANGE LANGUAGE** - Switch to a different language\n5️⃣ **🔓 LOGOUT** - Sign out and switch accounts\n\n💬 **Reply with the number** corresponding to your choice.",
    language_changed: "🌐 **Language changed successfully!**\n\nYour language preference has been updated and saved to your profile.\n\n💡 **Tip:** This setting will be remembered for future sessions.",
    no_history: "📊 **No Lead History**\n\nYou haven't completed any lead‑finding sessions yet.\n\n🚀 **Get started:** Choose option 1 to begin your first lead search!",
    history_header: "📊 **Your Scraping History**\n\nHere are your recent scraping jobs:",
    
    // Search Flow
    enter_niche: "🎯 **Enter your search query:**\n\n💬 **Examples:**\n• dentist casablanca\n• restaurant marrakech\n• web developer fes\n\n💡 **Tip:** Include location for better results\n\n0️⃣ **BACK TO MENU** - Return to main menu",
    invalid_niche: "⚠️ **Invalid input.** Please enter your search query (e.g., \"dentist casablanca\") or send 0 to go back to main menu.",
    
    // Source Selection
    select_source: "🎯 **What type of results do you want for \"{niche}\"?**\n\n1️⃣ **Contacts** – Emails 📧 & Phone Numbers 📱\n2️⃣ **Profiles** – Names, LinkedIn URLs & Job Info 👤\n3️⃣ **Businesses** – Names, Phones, Emails, Location & Website 🏢\n\n0️⃣ **Back** – Go back to niche input\n0️⃣0️⃣ **Restart** – Start a new search\n\n💬 **Reply with the number** corresponding to your choice.",
    
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
    format_set: "🚀 **Ready to start scraping!**\n\n0️⃣ **BACK** - Go back to format selection\n0️⃣0️⃣ **RESTART** - Start a new search\n\n💬 **Send:** START",
    
    // Configuration Commands
    source_set: "🎯 Data source set to: {source}",
    //format_set: "💾 Output format set to: {format}",
    limit_set: "📏 Result limit set to: {limit}",
    settings_updated: "✅ Settings updated successfully!",
    
    // Job Management
    job_starting: "🔍 **Starting lead‑finding session...**\n\n📋 **Session Details:**\n• Niche: \"{niche}\"\n• Source: {source}\n\n⏱️ **Progress updates will be sent automatically.**",
    job_complete: "✅ **Lead Finding Complete!**\n\n📊 **Results Summary:**\n• Total Results: {total}\n• Emails: {emails}\n• Phones: {phones}\n• Websites: {websites}\n\n💾 **File ready for download** ⬇️",
    job_stopped: "🛑 **Lead‑finding session stopped.**",
    job_status: "📊 **Current Job Status:** {status}",
    job_running: "⏳ **A lead‑finding session is currently in progress.**\n\n🛑 **Reply with STOP to cancel the current session.**",
    stop_confirmation: "🛑 **Stop Lead Finding Session?**\n\n⚠️ **Warning:** Stopping now will end the current session immediately.\n\n🚫 **Daily Limit Impact:** You will lose 1 of your 4 daily tries.\n\n💡 **Note:** Any results found so far will be saved and sent to you.\n\n💬 **Reply with:**\n• **1** to confirm stopping the session\n• **0** to continue the session",
    stop_success: "🛑 **Lead Finding Session Stopped!**\n\n✅ Your session has been stopped successfully.\n\n💡 **Note:** These are the results found so far. If you had let the job continue, you would have ended up with more comprehensive results.\n\n💾 **File ready for download** ⬇️",
    stop_no_results: "🛑 **Lead Finding Session Stopped!**\n\n❌ **No leads found** - The session was too short to generate results.\n\n💡 **Tip:** Try running the session longer for better results.",
    autosaved_results: "Auto-saved results",
    queued_waiting: "⏳ Many users are searching for leads right now. Your job will start as soon as possible. Please wait.",
    
    // Navigation
    go_back: "↩️ Please enter your new search niche.",
    restart: "🔄 *Restarted!*",
    reset: "♻️ **Preferences reset to defaults.**",
    
    // Help
    help: "📚 **Lead Finder Help**\n\n🔐 **CODE: <code>**\n   Authenticate with your access code\n   Example: \"CODE: user1\"\n\n🎯 **SOURCE: <source>**\n   Set data source: GOOGLE, LINKEDIN, MAPS\n\n📊 **STATUS**\n   Check current session status\n\n🛑 **STOP**\n   Cancel current lead‑finding session\n\n♻️ **RESET**\n   Reset all preferences\n\n🔄 **RESTART** (00)\n   Restart the entire process from niche selection\n\n❓ **HELP**\n   Show this help message\n\n💡 **Getting Started:**\n1. Get your access code from admin\n2. Send: CODE: your_code_here\n3. Send your search query (e.g., \"restaurant casablanca\")\n4. Follow the numbered prompts to configure source and type.\n5. Send: START to begin finding leads\n6. Receive real-time progress updates!\n\n**Navigation Tip:** At any numbered selection step, reply with `0` to go back to the previous step.",
    
    // Progress Messages
    progress_update: "⏱️ **Progress Update:** {message}",
    progress_complete: "🎉 Progress: 100% — Lead finding complete!",
    progress_analyzing: "🔍 *Progress: {progress}% - Analyzing search results...*",
    progress_processing: "⚙️ *Progress: {progress}% - Processing business data...*",
    progress_extracting: "📥 *Progress: {progress}% - Extracting contact information...*",
    progress_validating: "📊 *Progress: {progress}% - Validating business profiles...*",
    progress_compiling: "🎯 *Progress: {progress}% - Compiling results...*",
    progress_finalizing: "✨ *Progress: {progress}% - Finalizing data...*",
    
    // Errors
    error_generic: "❌ An error occurred. Please try again.",
    error_no_results: "📈 **Results Summary:**\n\n📊 **Total Results: 0**\n\n💡 **No results to save** - try running longer or adjust search terms",
    invalid_selection: "⚠️ Invalid selection. Please choose a number between 1 and {max} or 0 to go back.",
    error_generic_friendly: "❌ **Something went wrong.**\n\n💡 Please try again with a different niche. If the problem continues, contact support.",
    error_invalid_niche_maps: "❌ **Invalid niche for Google Maps.**\n\nYour query should describe a business and a location.\n\nExamples:\n• dentist casablanca\n• restaurant marrakech\n• web developer fes\n\n💡 Please send a clearer niche including a city or region.",
    trial_finished: "🧪 **Your free trial has ended.**\n\nYou used all 3 trial searches (20 results each).\n\n💳 Contact support to upgrade and continue.",
    subscription_expired: "⏳ **Subscription expired.**\n\nPlease contact support to renew your access.",
    trial_status_title: "🧪 **Free Trial Status**\n\n",
    trial_status_body: "You are on the free trial.\nTries used: {triesUsed}/{maxTries}\nRemaining: {remaining}\n\n",
    trial_welcome: "🎉 **Welcome to your Free Trial!**\n\nYou're all set to explore the Business Lead Finder.\n\n**How it works:**\n• 3 trial searches included\n• Each trial search returns up to 20 leads (trial limit). Upgrade to get unlimited results\n• Type STATUS anytime to see remaining tries\n\nWhen you're ready to continue after the trial, contact support to upgrade.\n\n✨ Happy lead finding!",
    paid_welcome: "🎉 **Welcome back!**\n\nYour subscription is active.\n\n**Good to know:**\n• Daily limit: 4 searches per day\n• Results per search: unlimited\n• Type STATUS anytime to see remaining searches\n\n✨ Let's find new leads!",
    
    // Daily limit status
    status_title: "📊 **Your Lead‑Finding Status**\n\n",
    daily_status_ok: "📊 **Daily Lead‑Finding Status:** {remaining}/{limit} remaining\n⏰ **Resets:** Tomorrow at midnight",
    daily_status_reached: "🚫 **Daily Limit Reached**\n\nYou have used all {limit} daily lead searches.\n⏰ **Come back tomorrow** to continue.\n\n💡 **Next reset:** {resetTime}",
    paid_status: "\n\n💳 Subscription: Active\n⏰ Expires: {expires}\n⌛ Remaining: {remaining}\n",
    
    // File Messages
    file_ready: "📎 **File ready for download:**",
    
    // Additional translations for completion messages
    summary: "Summary",
    results: "results",
    source: "Source",
    format: "Format",
    type: "Type",
    google_search_results: "Google Search Results",
    linkedin_profiles: "LinkedIn Profiles",
    google_maps_businesses: "Google Maps Businesses",
    file_not_sent: "File not sent",
    results_saved_later: "Results saved for later delivery",
    
    // PDF Guide Messages
    guide_sending: "📚 **Sending User Guide...**\n\n⏳ Please wait while we prepare your complete user guide in {language}...\n\n💡 **Do not send any messages** until the guide is delivered.",
    guide_processing: "⏳ **Guide is being processed...**\n\n📄 Your user guide is being prepared and will be sent shortly.\n\n⏳ **Please wait** - do not send any messages until the guide arrives.",
    guide_error: "❌ **Error sending guide**\n\nSorry, there was an error sending the user guide. Please try again later.\n\n0️⃣ **BACK TO MENU** - Return to main menu",
    
    // Logout Messages
    logout_confirmation: "🔓 **Confirm Logout**\n\n⚠️ Are you sure you want to logout?\n\nThis will end your current session and you'll need to authenticate again.\n\n💬 **Reply with:**\n• **5** to confirm logout\n• **0** to cancel and return to main menu",
    logout_successful: "🔓 **User Logout Successful!**\n\n✅ You have been logged out of your user session.\n\n💡 **To log back in:**\n• Send CODE: <user_code> to start a new user session\n• Example: CODE: user1",
    logout_error: "❌ **Error during logout**\n\nAn error occurred while logging out. Please try again or contact support."
  },
  
  fr: {
    // Welcome and Language Selection
    welcome: "🤖 **Bienvenue dans le Localisateur de Prospects!**\n\nVeuillez sélectionner votre langue préférée:\n\n1️⃣ **English**\n2️⃣ **Français**\n3️⃣ **العربية**\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
    language_selection: "🌐 **Sélection de Langue**\n\nVeuillez sélectionner votre langue préférée:\n\n1️⃣ **English**\n2️⃣ **Français**\n3️⃣ **العربية**\n\n💬 **Répondez avec le numéro** correspondant à votre choix.\n\n0️⃣ **RETOUR AU MENU** - Retourner au menu principal",
    
    // Authentication
    auth_required: "🔐 **Authentification requise.** Veuillez d'abord envoyer votre code d'accès.\n\n💬 **Format:** CODE: votre_code_ici\n💬 **Exemple:** CODE: user1\n\n💡 Contactez l'administrateur si vous n'avez pas de code d'accès.\n\n0️⃣ **CHANGER DE LANGUE** - Sélectionner une langue différente",
    invalid_code: "❌ Code d'accès invalide. Veuillez contacter l'administrateur pour un code valide.",
    access_granted: "✅ **Accès accordé!** Bienvenue dans le Localisateur de Prospects.\n\n📝 Envoyez une requête de recherche (ex: \"restaurant casablanca\").\n\n📅 **Limites Quotidiennes:** Vous pouvez effectuer 4 recherches de prospects par jour. Réinitialisation à minuit.\n\n💡 Utilisez la commande STATUS pour vérifier vos recherches restantes.",
    
    // Main Menu
    main_menu: "🏠 **Menu Principal**\n\nQue souhaitez-vous faire?\n\n1️⃣ **🚀 DÉMARRER LA RECHERCHE DE PROSPECTS** - Nouvelle session\n2️⃣ **📈 STATUT** - Vérifier votre statut et limites quotidiennes\n3️⃣ **📚 GUIDE UTILISATEUR** - Télécharger le guide complet (PDF)\n4️⃣ **🌐 CHANGER LA LANGUE** - Passer à une autre langue\n5️⃣ **🔓 DÉCONNEXION** - Se déconnecter et changer de compte\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
    language_changed: "🌐 **Langue changée avec succès!**\n\nVotre préférence de langue a été mise à jour et enregistrée dans votre profil.\n\n💡 **Conseil:** Ce paramètre sera conservé pour les sessions futures.",
    no_history: "📊 **Aucun Historique de Prospects**\n\nVous n'avez pas encore effectué de sessions de recherche de prospects.\n\n🚀 **Commencez:** Choisissez l'option 1 pour lancer votre première recherche!",
    history_header: "📊 **Votre Historique de Scraping**\n\nVoici vos derniers jobs de scraping:",
    
    // Search Flow
    enter_niche: "🎯 **Entrez votre requête de recherche:**\n\n💬 **Exemples:**\n• dentiste casablanca\n• restaurant marrakech\n• développeur web fes\n\n💡 **Conseil:** Incluez la localisation pour de meilleurs résultats\n\n0️⃣ **RETOUR AU MENU** - Retourner au menu principal",
    invalid_niche: "⚠️ **Entrée invalide.** Veuillez entrer votre requête de recherche (ex: \"dentiste casablanca\") ou envoyez 0 pour retourner au menu principal.",
    
    // Source Selection
    select_source: "🎯 **Quel type de résultats voulez-vous pour \"{niche}\"?**\n\n1️⃣ **Contacts** – Emails 📧 & Numéros de Téléphone 📱\n2️⃣ **Profils** – Noms, URLs LinkedIn & Infos Professionnelles 👤\n3️⃣ **Entreprises** – Noms, Téléphones, Emails, Localisation & Site Web 🏢\n\n0️⃣ **Retour** – Retour à la saisie de niche\n0️⃣0️⃣ **Redémarrer** – Commencer une nouvelle recherche\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
    
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
    format_set: "🚀 **Prêt à commencer le scraping!**\n\n0️⃣ **RETOUR** - Retour à la sélection de format\n0️⃣0️⃣ **REDÉMARRER** - Commencer une nouvelle recherche\n\n💬 **Envoyez:** START",
    
    // Configuration Commands
    source_set: "🎯 Source de données définie sur: {source}",
    //format_set: "💾 Format de sortie défini sur: {format}",
    limit_set: "📏 Limite de résultats définie sur: {limit}",
    settings_updated: "✅ Paramètres mis à jour avec succès!",
    
    // Job Management
    job_starting: "🔍 **Démarrage de la session de recherche de prospects...**\n\n📋 **Détails de la session:**\n• Niche: \"{niche}\"\n• Source: {source}\n\n⏱️ **Mises à jour envoyées automatiquement.**",
    job_complete: "✅ **Recherche de prospects terminée!**\n\n📊 **Résumé des Résultats:**\n• Total: {total}\n• Emails: {emails}\n• Téléphones: {phones}\n• Sites Web: {websites}\n\n💾 **Fichier prêt au téléchargement** ⬇️",
    job_stopped: "🛑 **Session interrompue.**",
    job_status: "📊 **Statut Actuel du Job:** {status}",
    job_running: "⏳ **Une session de recherche de prospects est en cours.**\n\n🛑 **Répondez avec STOP pour annuler la session en cours.**",
    stop_confirmation: "🛑 **Arrêter la Session de Recherche de Prospects?**\n\n⚠️ **Attention:** L'arrêt maintenant mettra fin à la session en cours immédiatement.\n\n🚫 **Impact sur la Limite Quotidienne:** Vous perdrez 1 de vos 4 essais quotidiens.\n\n💡 **Note:** Tous les résultats trouvés jusqu'à présent seront sauvegardés et envoyés.\n\n💬 **Répondez avec:**\n• **1** pour confirmer l'arrêt de la session\n• **0** pour continuer la session",
    stop_success: "🛑 **Session de Recherche de Prospects Arrêtée!**\n\n✅ Votre session a été arrêtée avec succès.\n\n💡 **Note:** Ce sont les résultats trouvés jusqu'à présent. Si vous aviez laissé la tâche continuer, vous auriez obtenu des résultats plus complets.\n\n💾 **Fichier prêt au téléchargement** ⬇️",
    stop_no_results: "🛑 **Session de Recherche de Prospects Arrêtée!**\n\n❌ **Aucun prospect trouvé** - La session était trop courte pour générer des résultats.\n\n💡 **Conseil:** Essayez de faire fonctionner la session plus longtemps pour de meilleurs résultats.",
    autosaved_results: "Résultats auto-sauvegardés",
    queued_waiting: "⏳ De nombreux utilisateurs recherchent des prospects en ce moment. Votre tâche démarrera dès que possible. Merci de patienter.",
    
    // Navigation
    go_back: "↩️ Veuillez entrer votre nouvelle niche de recherche.",
    restart: "🔄 *Redémarré!*",
    reset: "♻️ **Préférences remises aux valeurs par défaut.**",
    
    // Help
    help: "📚 **Aide – Localisateur de Prospects**\n\n🔐 **CODE: <code>**\n   Authentifiez-vous avec votre code d'accès\n   Exemple: \"CODE: user1\"\n\n🎯 **SOURCE: <source>**\n   Définir la source: GOOGLE, LINKEDIN, MAPS\n\n📊 **STATUT**\n   Vérifier le statut de la session\n\n🛑 **STOP**\n   Annuler la session en cours\n\n♻️ **RESET**\n   Réinitialiser les préférences\n\n🔄 **RESTART** (00)\n   Redémarrer depuis la sélection de niche\n\n❓ **HELP**\n   Afficher cette aide\n\n💡 **Pour Commencer:**\n1. Obtenez votre code d'accès\n2. Envoyez: CODE: votre_code_ici\n3. Envoyez votre requête (ex: \"restaurant casablanca\")\n4. Configurez source et type\n5. Envoyez: START pour commencer la recherche de prospects\n6. Suivez les mises à jour!\n\n**Astuce:** À chaque étape numérotée, répondez `0` pour revenir en arrière.",
    
    // Progress Messages
    progress_update: "⏱️ **Mise à Jour de Progression:** {message}",
    progress_complete: "🎉 Progression: 100% — Recherche terminée!",
    progress_analyzing: "🔍 *Progression: {progress}% - Analyse des résultats de recherche...*",
    progress_processing: "⚙️ *Progression: {progress}% - Traitement des données d'entreprise...*",
    progress_extracting: "📥 *Progression: {progress}% - Extraction des informations de contact...*",
    progress_validating: "📊 *Progression: {progress}% - Validation des profils d'entreprise...*",
    progress_compiling: "🎯 *Progression: {progress}% - Compilation des résultats...*",
    progress_finalizing: "✨ *Progression: {progress}% - Finalisation des données...*",
    
    // Errors
    error_generic: "❌ Une erreur s'est produite. Veuillez réessayer.",
    error_no_results: "📈 **Résumé des Résultats:**\n\n📊 **Total des Résultats: 0**\n\n💡 **Aucun résultat à sauvegarder** - essayez de lancer plus longtemps ou ajustez les termes de recherche",
    invalid_selection: "⚠️ Sélection invalide. Veuillez choisir un numéro entre 1 et {max} ou 0 pour revenir en arrière.",
    error_generic_friendly: "❌ **Un problème est survenu.**\n\n💡 Veuillez réessayer avec une autre niche. Si le problème persiste, contactez le support.",
    error_invalid_niche_maps: "❌ **Niche invalide pour Google Maps.**\n\nVotre requête doit décrire une activité et un lieu.\n\nExemples:\n• dentiste casablanca\n• restaurant marrakech\n• développeur web fes\n\n💡 Envoyez une niche plus claire incluant une ville ou une région.",
    trial_finished: "🧪 **Votre période d'essai est terminée.**\n\nVous avez utilisé les 3 recherches d'essai (20 résultats chacune).\n\n💳 Contactez le support pour passer à l'abonnement.",
    subscription_expired: "⏳ **Abonnement expiré.**\n\nVeuillez contacter le support pour renouveler votre accès.",
    trial_status_title: "🧪 **Statut de l'essai gratuit**\n\n",
    trial_status_body: "Vous êtes en période d'essai.\nEssais utilisés : {triesUsed}/{maxTries}\nRestants : {remaining}\n\n",
    trial_welcome: "🎉 **Bienvenue dans votre essai gratuit !**\n\nVous êtes prêt à explorer le Localisateur de Prospects.\n\n**Fonctionnement de l'essai :**\n• 3 recherches d'essai incluses\n• Chaque recherche d'essai renvoie jusqu’à 20 prospects (limite d’essai). Passez à l’abonnement pour des résultats illimités\n• Tapez STATUS à tout moment pour voir les essais restants\n\nPrêt à continuer après l’essai ? Contactez le support pour passer à l’abonnement.\n\n✨ Bonne prospection !",
    paid_welcome: "🎉 **Content de vous revoir !**\n\nVotre abonnement est actif.\n\n**À savoir :**\n• Limite quotidienne : 4 recherches par jour\n• Résultats par recherche : illimités\n• Tapez STATUS à tout moment pour voir le restant\n\n✨ Allons trouver de nouveaux prospects !",
    
    // Daily limit status
    status_title: "📊 **Votre statut de recherche de prospects**\n\n",
    daily_status_ok: "📊 **Statut quotidien :** {remaining}/{limit} restants\n⏰ **Réinitialisation :** Demain à minuit",
    daily_status_reached: "🚫 **Limite quotidienne atteinte**\n\nVous avez utilisé toutes vos {limit} recherches quotidiennes.\n⏰ **Revenez demain** pour continuer.\n\n💡 **Prochaine réinitialisation :** {resetTime}",
    paid_status: "\n\n💳 Abonnement : Actif\n⏰ Expire le : {expires}\n⌛ Remant : {remaining}\n",
    
    // File Messages
    file_ready: "📎 **Fichier prêt pour téléchargement:**",
    
    // Additional translations for completion messages
    summary: "Résumé",
    results: "résultats",
    source: "Source",
    format: "Format",
    type: "Type",
    google_search_results: "Résultats de recherche Google",
    linkedin_profiles: "Profils LinkedIn",
    google_maps_businesses: "Entreprises Google Maps",
    file_not_sent: "Fichier non envoyé",
    results_saved_later: "Résultats sauvegardés pour envoi ultérieur",
    
    // PDF Guide Messages
    guide_sending: "📚 **Envoi du Guide Utilisateur...**\n\n⏳ Veuillez patienter pendant que nous préparons votre guide complet en {language}...\n\n💡 **N'envoyez aucun message** jusqu'à ce que le guide soit livré.",
    guide_processing: "⏳ **Le guide est en cours de traitement...**\n\n📄 Votre guide utilisateur est en cours de préparation et sera envoyé sous peu.\n\n⏳ **Veuillez patienter** - n'envoyez aucun message jusqu'à l'arrivée du guide.",
    guide_error: "❌ **Erreur d'envoi du guide**\n\nDésolé, il y a eu une erreur lors de l'envoi du guide. Veuillez réessayer plus tard.\n\n0️⃣ **RETOUR AU MENU** - Retourner au menu principal",
    
    // Logout Messages
    logout_confirmation: "🔓 **Confirmer la Déconnexion**\n\n⚠️ Êtes-vous sûr de vouloir vous déconnecter?\n\nCela mettra fin à votre session actuelle et vous devrez vous authentifier à nouveau.\n\n💬 **Répondez avec:**\n• **5** pour confirmer la déconnexion\n• **0** pour annuler et retourner au menu principal",
    logout_successful: "🔓 **Déconnexion Utilisateur Réussie!**\n\n✅ Vous avez été déconnecté de votre session utilisateur.\n\n💡 **Pour vous reconnecter:**\n• Envoyez CODE: <votre_code> pour commencer une nouvelle session utilisateur\n• Exemple: CODE: user1",
    logout_error: "❌ **Erreur lors de la déconnexion**\n\nUne erreur s'est produite lors de la déconnexion. Veuillez réessayer ou contacter le support."
  },
  
  ar: {
    // Welcome and Language Selection
    welcome: "🤖 **مرحباً بك في مُحدِّد العملاء المحتملين!**\n\nيرجى اختيار لغتك المفضلة:\n\n1️⃣ **English**\n2️⃣ **Français**\n3️⃣ **العربية**\n\n💬 **أرسل الرقم** المقابل لاختيارك.",
    language_selection: "🌐 **اختيار اللغة**\n\nيرجى اختيار لغتك المفضلة:\n\n1️⃣ **English**\n2️⃣ **Français**\n3️⃣ **العربية**\n\n💬 **أرسل الرقم** المقابل لاختيارك.\n\n0️⃣ **العودة إلى القائمة** - العودة إلى القائمة الرئيسية",
    
    // Authentication
    auth_required: "🔐 **مطلوب مصادقة.** يرجى إرسال رمز الوصول أولاً.\n\n💬 **التنسيق:** CODE: رمزك_هنا\n💬 **مثال:** CODE: user1\n\n💡 اتصل بالمدير إذا لم يكن لديك رمز وصول.\n\n0️⃣ **تغيير اللغة** - اختر لغة مختلفة",
    invalid_code: "❌ رمز وصول غير صحيح. يرجى الاتصال بالمدير للحصول على رمز صحيح.",
    access_granted: "✅ **تم منح الوصول!** مرحباً بك في محدِّد العملاء المحتملين.\n\n📝 أرسل استعلام بحث (مثال: \"مطعم الدار البيضاء\").\n\n📅 **الحدود اليومية:** يمكنك إجراء 4 عمليات بحث عن العملاء المحتملين يومياً. تُعاد التهيئة عند منتصف الليل.\n\n💡 استخدم STATUS للتحقق من الباقي.",
    
    // Main Menu
    main_menu: "🏠 **القائمة الرئيسية**\n\nماذا تريد أن تفعل؟\n\n1️⃣ **🚀 بدء البحث عن العملاء المحتملين** - بدء جلسة جديدة\n2️⃣ **📈 الحالة** - التحقق من الحالة والحدود اليومية\n3️⃣ **📚 دليل المستخدم** - تحميل الدليل الكامل (PDF)\n4️⃣ **🌐 تغيير اللغة** - تغيير اللغة المفضلة\n5️⃣ **🔓 تسجيل الخروج** - تسجيل الخروج وتغيير الحساب\n\n💬 **أرسل الرقم** المقابل لاختيارك.",
    language_changed: "🌐 **تم تغيير اللغة بنجاح!**\n\nتم تحديث تفضيل اللغة وحفظه في ملف الملف الشخصي.\n\n💡 **نصيحة:** سيتم تذكر هذه الإعداد للجلسات القادمة.",
    no_history: "📊 **لا يوجد سجل للعملاء المحتملين**\n\nلم تُكمل أي جلسات بحث حتى الآن.\n\n🚀 **ابدأ:** اختر الخيار 1 لبدء أول جلسة بحث!",
    history_header: "📊 **تاريخ استخراج البيانات الخاص بك**\n\nهذه هي آخر مهام استخراج البيانات الخاصة بك:",
    
    // Search Flow
    enter_niche: "🎯 **أدخل استعلام البحث الخاص بك:**\n\n💬 **أمثلة:**\n• طبيب أسنان الدار البيضاء\n• مطعم مراكش\n• مطور ويب فاس\n\n💡 **نصيحة:** أضف الموقع للحصول على نتائج أفضل\n\n0️⃣ **العودة إلى القائمة** - العودة إلى القائمة الرئيسية",
    invalid_niche: "⚠️ **إدخال غير صحيح.** يرجى إدخال استعلام البحث الخاص بك (مثال: \"طبيب أسنان الدار البيضاء\") أو أرسل 0 للعودة إلى القائمة الرئيسية.",
    
    // Source Selection
    select_source: "🎯 **ما نوع النتائج التي تريدها لـ \"{niche}\"؟**\n\n1️⃣ **جهات الاتصال** – الإيميلات 📧 & أرقام الهواتف 📱\n2️⃣ **الملفات الشخصية** – الأسماء، روابط LinkedIn & معلومات الوظيفة 👤\n3️⃣ **الشركات** – الأسماء، الهواتف، الإيميلات، الموقع & الموقع الإلكتروني 🏢\n\n0️⃣ **رجوع** – العودة لإدخال النيش\n0️⃣0️⃣ **إعادة تشغيل** - بدء بحث جديد\n\n💬 **أرسل الرقم** المقابل لاختيارك.",
    
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
    format_set: "🚀 **جاهز لبدء الاستخراج!**\n\n0️⃣ **رجوع** - العودة لاختيار التنسيق\n0️⃣0️⃣ **إعادة تشغيل** - بدء بحث جديد\n\n💬 **أرسل:** START",
    
    // Configuration Commands
    source_set: "🎯 تم تعيين مصدر البيانات على: {source}",
    //format_set: "💾 تم تعيين تنسيق الإخراج على: {format}",
    limit_set: "📏 تم تعيين حد النتائج على: {limit}",
    settings_updated: "✅ تم تحديث الإعدادات بنجاح!",
    
    // Job Management
    job_starting: "🔍 **بدء جلسة البحث عن العملاء المحتملين...**\n\n📋 **تفاصيل الجلسة:**\n• النيش: \"{niche}\"\n• المصدر: {source}\n\n⏱️ **سيتم إرسال التحديثات تلقائياً.**",
    job_complete: "✅ **اكتملت عملية البحث!**\n\n📊 **ملخص النتائج:**\n• إجمالي النتائج: {total}\n• البريد الإلكتروني: {emails}\n• الهاتف: {phones}\n• مواقع الويب: {websites}\n\n💾 **الملف جاهز للتحميل** ⬇️",
    job_stopped: "🛑 **تم إيقاف الجلسة.**",
    job_status: "📊 **حالة المهمة الحالية:** {status}",
    job_running: "⏳ **جلسة البحث عن العملاء المحتملين قيد التشغيل حالياً.**\n\n🛑 **أرسل STOP لإلغاء الجلسة الحالية.**",
    stop_confirmation: "🛑 **إيقاف جلسة البحث عن العملاء المحتملين؟**\n\n⚠️ **تحذير:** الإيقاف الآن سينهي الجلسة الحالية فوراً.\n\n🚫 **تأثير الحد اليومي:** ستخسر 1 من محاولاتك الأربع اليومية.\n\n💡 **ملاحظة:** أي نتائج تم العثور عليها حتى الآن سيتم حفظها وإرسالها إليك.\n\n💬 **أرسل:**\n• **1** لتأكيد إيقاف الجلسة\n• **0** لمواصلة الجلسة",
    stop_success: "🛑 **تم إيقاف جلسة البحث عن العملاء المحتملين!**\n\n✅ تم إيقاف جلستك بنجاح.\n\n💡 **ملاحظة:** هذه هي النتائج التي تم العثور عليها حتى الآن. إذا كنت قد تركت المهمة تستمر، لكانت النتائج أكثر شمولاً.\n\n💾 **الملف جاهز للتحميل** ⬇️",
    stop_no_results: "🛑 **تم إيقاف جلسة البحث عن العملاء المحتملين!**\n\n❌ **لم يتم العثور على عملاء محتملين** - كانت الجلسة قصيرة جداً لتوليد نتائج.\n\n💡 **نصيحة:** حاول تشغيل الجلسة لفترة أطول للحصول على نتائج أفضل.",
    autosaved_results: "نتائج محفوظة تلقائياً",
    queued_waiting: "⏳ هناك عدد كبير من المستخدمين يبحثون عن عملاء محتملين الآن. ستبدأ مهمتك في أقرب وقت ممكن. يرجى الانتظار.",
    
    // Navigation
    go_back: "↩️ يرجى إدخال نيش البحث الجديد الخاص بك.",
    restart: "🔄 *تمت إعادة التشغيل!*",
    reset: "♻️ **تم إعادة تعيين التفضيلات إلى القيم الافتراضية.**",
    
    // Help
    help: "📚 **مساعدة – محدِّد العملاء المحتملين**\n\n🔐 **CODE: <code>**\n   المصادقة برمز الوصول الخاص بك\n   مثال: \"CODE: user1\"\n\n🎯 **SOURCE: <source>**\n   تعيين المصدر: GOOGLE, LINKEDIN, MAPS\n\n📏 **LIMIT: <number>**\n   الحد الأقصى للنتائج (1-500). الافتراضي: 300\n\n📊 **STATUS**\n   التحقق من حالة الجلسة\n\n🛑 **STOP**\n   إلغاء الجلسة الحالية\n\n♻️ **RESET**\n   إعادة تعيين التفضيلات\n\n🔄 **RESTART** (00)\n   إعادة التشغيل من اختيار النيش\n\n❓ **HELP**\n   عرض هذه المساعدة\n\n💡 **للبدء:**\n1. احصل على رمز الوصول\n2. أرسل: CODE: رمزك_هنا\n3. أرسل استعلامك (مثال: \"مطعم الدار البيضاء\")\n4. كوّن المصدر والنوع\n5. أرسل: START لبدء البحث عن العملاء المحتملين\n6. استلم التحديثات!\n\n**نصيحة:** في أي خطوة مرقمة، أرسل `0` للعودة.",
    
    // Progress Messages
    progress_update: "⏱️ **تحديث التقدم:** {message}",
    progress_complete: "🎉 التقدم: 100% — اكتمل البحث!",
    progress_analyzing: "🔍 *التقدم: {progress}% - تحليل نتائج البحث...*",
    progress_processing: "⚙️ *التقدم: {progress}% - معالجة بيانات الأعمال...*",
    progress_extracting: "📥 *التقدم: {progress}% - استخراج معلومات الاتصال...*",
    progress_validating: "📊 *التقدم: {progress}% - التحقق من صحة ملفات الأعمال...*",
    progress_compiling: "🎯 *التقدم: {progress}% - تجميع النتائج...*",
    progress_finalizing: "✨ *التقدم: {progress}% - إنهاء البيانات...*",
    
    // Errors
    error_generic: "❌ حدث خطأ. يرجى المحاولة مرة أخرى.",
    error_no_results: "📈 **ملخص النتائج:**\n\n📊 **إجمالي النتائج: 0**\n\n💡 **لا توجد نتائج للحفظ** - جرب التشغيل لفترة أطول أو اضبط مصطلحات البحث",
    invalid_selection: "⚠️ اختيار غير صحيح. يرجى اختيار رقم بين 1 و {max} أو 0 للرجوع.",
    error_generic_friendly: "❌ **حدث خطأ ما.**\n\n💡 يرجى المحاولة مرة أخرى باستخدام نيش مختلف. إذا استمرت المشكلة، تواصل مع الدعم.",
    error_invalid_niche_maps: "❌ **نيش غير صالح لخرائط Google.**\n\nيجب أن يصف الاستعلام نشاطاً وموقعاً.\n\nأمثلة:\n• طبيب أسنان الدار البيضاء\n• مطعم مراكش\n• مطور ويب فاس\n\n💡 أرسل نيشاً أوضح يتضمن مدينة أو منطقة.",
    trial_finished: "🧪 **انتهت الفترة التجريبية.**\n\nلقد استخدمت 3 محاولات تجريبية (20 نتيجة لكل محاولة).\n\n💳 يرجى التواصل معنا للترقية.",
    subscription_expired: "⏳ **انتهى الاشتراك.**\n\nيرجى التواصل لتجديد الوصول.",
    trial_status_title: "🧪 **حالة الفترة التجريبية**\n\n",
    trial_status_body: "أنت على الفترة التجريبية.\nالمحاولات المستخدمة: {triesUsed}/{maxTries}\nالمتبقي: {remaining}\n\n",
    trial_welcome: "🎉 **أهلاً بك في الفترة التجريبية!**\n\nأنت جاهز لاستكشاف مُحدِّد العملاء المحتملين.\n\n**طريقة عمل التجربة:**\n• 3 محاولات بحث تجريبية\n• كل محاولة تجريبية تُرسل حتى 20 نتيجة (حدّ التجربة). بالترقية تحصل على نتائج غير محدودة\n• أرسل STATUS في أي وقت لمعرفة المتبقي\n\nعند استعدادك للاستمرار بعد التجربة، تواصل معنا للترقية.\n\n✨ نتمنى لك تجربة موفقة!",
    paid_welcome: "🎉 **مرحباً بعودتك!**\n\nاشتراكك نشِط.\n\n**معلومات مهمة:**\n• الحد اليومي: 4 عمليات بحث يومياً\n• النتائج لكل بحث: غير محدودة\n• أرسل STATUS في أي وقت لمعرفة المتبقي\n\n✨ هيا نبدأ بالعثور على عملاء جدد!",
    
    // Daily limit status
    status_title: "📊 **حالة البحث عن العملاء المحتملين**\n\n",
    daily_status_ok: "📊 **الحالة اليومية:** {remaining}/{limit} متبقٍ\n⏰ **إعادة التعيين:** غداً عند منتصف الليل",
    daily_status_reached: "🚫 **تم الوصول إلى الحد اليومي**\n\nلقد استخدمت كل {limit} عمليات البحث اليومية.\n⏰ **عد غداً** للمتابعة.\n\n💡 **إعادة التعيين التالية:** {resetTime}",
    paid_status: "\n\n💳 الاشتراك: نشِط\n⏰ ينتهي في: {expires}\n⌛ المتبقي: {remaining}\n",
    
    // File Messages
    file_ready: "📎 **الملف جاهز للتحميل:**",
    
    // Additional translations for completion messages
    summary: "الملخص",
    results: "نتائج",
    source: "المصدر",
    format: "التنسيق",
    type: "النوع",
    google_search_results: "نتائج بحث Google",
    linkedin_profiles: "الملفات الشخصية على LinkedIn",
    google_maps_businesses: "أعمال خرائط Google",
    file_not_sent: "لم يتم إرسال الملف",
    results_saved_later: "تم حفظ النتائج للإرسال لاحقاً",
    
    // PDF Guide Messages
    guide_sending: "📚 **إرسال دليل المستخدم...**\n\n⏳ يرجى الانتظار بينما نقوم بتحضير دليلك الكامل باللغة {language}...\n\n💡 **لا ترسل أي رسائل** حتى يتم تسليم الدليل.",
    guide_processing: "⏳ **الدليل قيد المعالجة...**\n\n📄 دليل المستخدم الخاص بك قيد التحضير وسيتم إرساله قريباً.\n\n⏳ **يرجى الانتظار** - لا ترسل أي رسائل حتى وصول الدليل.",
    guide_error: "❌ **خطأ في إرسال الدليل**\n\nعذراً، حدث خطأ في إرسال دليل المستخدم. يرجى المحاولة مرة أخرى لاحقاً.\n\n0️⃣ **العودة إلى القائمة** - العودة إلى القائمة الرئيسية",
    
    // Logout Messages
    logout_confirmation: "🔓 **تأكيد تسجيل الخروج**\n\n⚠️ هل أنت متأكد من أنك تريد تسجيل الخروج؟\n\nسيؤدي هذا إلى إنهاء جلستك الحالية وستحتاج إلى المصادقة مرة أخرى.\n\n💬 **أرسل:**\n• **5** لتأكيد تسجيل الخروج\n• **0** للإلغاء والعودة إلى القائمة الرئيسية",
    logout_successful: "🔓 **تم تسجيل الخروج بنجاح!**\n\n✅ تم تسجيل خروجك من جلسة المستخدم.\n\n💡 **للإعادة تسجيل الدخول:**\n• أرسل CODE: <رمز_المستخدم> لبدء جلسة مستخدم جديدة\n• مثال: CODE: user1",
    logout_error: "❌ **خطأ أثناء تسجيل الخروج**\n\nحدث خطأ أثناء تسجيل الخروج. يرجى المحاولة مرة أخرى أو الاتصال بالدعم."
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
