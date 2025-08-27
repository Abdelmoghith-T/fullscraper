import { config } from '../config.js';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

/**
 * Export results to CSV, Excel, or Text format
 * @param {Array} results - Array of result objects
 * @param {string} format - Export format ('csv', 'xlsx', or 'txt')
 * @param {string} filename - Output filename
 * @param {string} niche - Target niche for text format headers
 * @returns {Promise<string>} - Generated filename
 */
export async function exportResults(results, format = 'csv', filename = null, niche = '') {
  try {
    if (!results || results.length === 0) {
      console.log(chalk.yellow('⚠️  No results to export'));
      return null;
    }

    // Check if this is LinkedIn data (has name and profileUrl fields)
    const isLinkedInData = results.length > 0 && results[0].name && results[0].profileUrl;
    
    if (isLinkedInData) {
      return await exportLinkedInResults(results, format, filename);
    }

    // Generate filename if not provided
    if (!filename) {
      const timestamp = Date.now();
      filename = format === 'xlsx' ? `results_${timestamp}.xlsx` : `results_${timestamp}.csv`;
    }

    if (format === 'xlsx') {
      return await exportToExcel(results, filename);
    } else if (format === 'txt') {
      return await exportToText(results, filename, niche);
    } else {
      return await exportToCsv(results, filename);
    }

  } catch (error) {
    console.error(chalk.red(`❌ Export failed: ${error.message}`));
    throw error;
  }
}

/**
 * Export LinkedIn results with deduplication
 * @param {Array} results - Array of LinkedIn profile objects
 * @param {string} format - Export format ('csv' or 'xlsx')
 * @param {string} filename - Output filename
 * @param {string} niche - Target niche for filename generation
 */
export async function exportLinkedInResults(results, format, filename, niche = null) {
  try {
    console.log(`📊 LinkedIn Export Summary:`);
    console.log(`   • Total Profiles Found: ${results.length}`);
    
    // Deduplicate profiles
    const uniqueProfiles = deduplicateLinkedInProfiles(results);
    console.log(`   • Unique Profiles: ${uniqueProfiles.length}`);
    console.log(`   • Duplicates Removed: ${results.length - uniqueProfiles.length}`);
    
    if (format === 'csv') {
      return await exportLinkedInToCsv(uniqueProfiles, filename);
    } else {
      // For Excel, use the provided filename if available, otherwise extract niche
      if (filename && filename.endsWith('.xlsx')) {
        // Use the provided filename directly, and pass the niche if available
        return await exportLinkedInToExcel(uniqueProfiles, niche || 'linkedin_profiles', filename);
      } else {
      // Extract niche from filename or use a default
        const extractedNiche = filename ? filename.replace(/_linkedin_results.*$/, '') : (niche || 'linkedin_profiles');
        return await exportLinkedInToExcel(uniqueProfiles, extractedNiche);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error exporting LinkedIn results: ${error.message}`);
    throw error;
  }
}

/**
 * Enhanced deduplication for LinkedIn profiles
 * Removes duplicates based on name, URL, and bio similarity
 * @param {Array} profiles - Array of LinkedIn profile objects
 * @returns {Array} Deduplicated profiles
 */
function deduplicateLinkedInProfiles(profiles) {
  const seenUrls = new Set();
  const seenNames = new Set();
  const uniqueProfiles = [];
  
  for (const profile of profiles) {
    if (!profile.name || !profile.profileUrl) continue;
    
    // Normalize name and URL
    const normalizedName = profile.name.toLowerCase().trim().replace(/\s+/g, ' ');
    const normalizedUrl = profile.profileUrl.toLowerCase().trim();
    
    // Check for exact URL duplicates
    if (seenUrls.has(normalizedUrl)) {
      continue; // Skip duplicate URLs
    }
    
    // Check for name duplicates (with some tolerance for minor variations)
    const nameKey = normalizedName.replace(/[^a-z0-9]/g, ''); // Remove special chars for comparison
    if (seenNames.has(nameKey)) {
      // Check if it's the same person with different URL formats
      const existingProfile = uniqueProfiles.find(p => {
        const existingName = p.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        return existingName === nameKey;
      });
      
      if (existingProfile) {
        // Keep the one with more complete information
        const currentScore = calculateProfileCompleteness(profile);
        const existingScore = calculateProfileCompleteness(existingProfile);
        
        if (currentScore > existingScore) {
          // Replace existing profile with better one
          const index = uniqueProfiles.indexOf(existingProfile);
          uniqueProfiles[index] = profile;
          seenUrls.add(normalizedUrl);
        }
        continue;
      }
    }
    
    // Add new unique profile
    seenUrls.add(normalizedUrl);
    seenNames.add(nameKey);
    uniqueProfiles.push(profile);
  }
  
  console.log(chalk.cyan(`📊 LinkedIn Deduplication: ${profiles.length} → ${uniqueProfiles.length} unique profiles`));
  console.log(chalk.gray(`   • Duplicates removed: ${profiles.length - uniqueProfiles.length}`));
  
  return uniqueProfiles;
}

/**
 * Calculate profile completeness score
 * @param {Object} profile - LinkedIn profile object
 * @returns {number} Completeness score (0-100)
 */
function calculateProfileCompleteness(profile) {
  let score = 0;
  
  if (profile.name) score += 20;
  if (profile.profileUrl) score += 20;
  if (profile.bio && profile.bio.length > 10) score += 30;
  if (profile.company) score += 15;
  if (profile.isCompanyPage !== undefined) score += 15;
  
  return score;
}

/**
 * Export LinkedIn results to CSV format
 * @param {Array} profiles - Array of LinkedIn profile objects
 * @param {string} filename - Output filename
 * @returns {Promise<string>} - Generated filename
 */
async function exportLinkedInToCsv(profiles, filename) {
  try {
    const fsPromises = await import('fs/promises');
    
    // Generate filename if not provided
    if (!filename) {
      const timestamp = Date.now();
      filename = `linkedin_results_${timestamp}.csv`;
    }
    
    // Create CSV header
    const headers = ['Name', 'Profile URL', 'Bio', 'Source', 'Query'];
    const csvHeader = headers.join(',') + '\n';
    
    // Create CSV rows
    const csvRows = profiles.map(profile => {
      const name = (profile.name || '').replace(/"/g, '""'); // Escape quotes
      const profileUrl = (profile.profileUrl || '').replace(/"/g, '""');
      const bio = (profile.bio || '').replace(/"/g, '""').replace(/\n/g, ' '); // Remove newlines
      const source = profile.source || 'linkedin';
      const query = (profile.query || '').replace(/"/g, '""');
      
      return `"${name}","${profileUrl}","${bio}","${source}","${query}"`;
    });
    
    const csvContent = csvHeader + csvRows.join('\n');
    
    // Write to file
    await fsPromises.writeFile(filename, csvContent, 'utf8');
    
    console.log(chalk.green(`✅ LinkedIn CSV exported: ${filename}`));
    
    // Verify file was created using the global fs import
    const stats = fs.statSync(filename);
    console.log(`✅ File verified: ${filename} (${stats.size} bytes)`);
    
    return filename;
    
  } catch (error) {
    console.error(chalk.red(`❌ LinkedIn CSV export failed: ${error.message}`));
    throw error;
  }
}

/**
 * Export LinkedIn results to Excel
 * @param {Array} results - LinkedIn profile results
 * @param {string} niche - Target niche
 * @param {string} providedFilename - Optional provided filename
 * @returns {string} File path
 */
export async function exportLinkedInToExcel(results, niche, providedFilename = null) {
  try {
    console.log(`💾 Saving ${results.length} validated results...`);
    console.log(`🔍 Debug: XLSX version: ${XLSX.version}`);
    console.log(`🔍 Debug: Results array length: ${results.length}`);
    console.log(`🔍 Debug: First result sample:`, results[0] ? Object.keys(results[0]) : 'No results');
    console.log(`🔍 Debug: Niche parameter: "${niche}"`);
    
    // Prepare data for Excel with hyperlinks
    const data = results.map(profile => ({
      'Name': profile.name || '',
      'Profile Link': profile.profileUrl || '',
      'Bio': (profile.bio || '').substring(0, 200) + (profile.bio && profile.bio.length > 200 ? '...' : ''), // Truncate bio
      'Type': profile.isCompanyPage ? 'Company' : 'Individual'
    }));
    
    console.log(`🔍 Debug: Prepared data length: ${data.length}`);
    
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    console.log(`🔍 Debug: Workbook created successfully`);
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    console.log(`🔍 Debug: Worksheet created successfully`);
    
    // Add hyperlinks to profile URLs using proper Excel hyperlink format
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const urlCell = XLSX.utils.encode_cell({ r: row, c: 1 }); // Profile Link column (B)
      const url = worksheet[urlCell]?.v;
      
      if (url && url.startsWith('http')) {
        // Set the cell value to the URL and add hyperlink formatting
        worksheet[urlCell] = {
          v: url,
          l: { Target: url, Tooltip: 'Click to open LinkedIn profile' }
        };
      }
    }
    
    // Set column widths and text wrapping for better readability
    worksheet['!cols'] = [
      { width: 25 }, // Name
      { width: 45 }, // Profile Link
      { width: 50 }, // Bio (with text wrapping)
      { width: 15 }  // Type
    ];
    
    // Add text wrapping to Bio column
    const bioColIndex = 2; // Column C (0-indexed)
    for (let row = range.s.r; row <= range.e.r; row++) {
      const bioCell = XLSX.utils.encode_cell({ r: row, c: bioColIndex });
      if (worksheet[bioCell]) {
        worksheet[bioCell].s = {
          alignment: {
            wrapText: true,
            vertical: 'top'
          }
        };
      }
    }
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'LinkedIn Profiles');
    
    // Generate filename with results directory path
    const timestamp = Date.now();
    
    // Try multiple possible results directory paths
    // Since the scraper runs from lead-scraper directory, we need to go up to find the main results directory
    let resultsDir = null;
    const possiblePaths = [
      // From lead-scraper directory, go up to find main results directory
      path.join(process.cwd(), '..', '..', '..', 'results'),  // fullscraper/results
      path.join(process.cwd(), '..', '..', 'results'),        // lead-scraper/results (fallback)
      path.join(process.cwd(), '..', 'results'),              // lead-scraper/results (closer fallback)
      path.join(process.cwd(), 'results'),                    // lead-scraper/results (current directory)
      // Try absolute paths to avoid relative path issues
      path.resolve('./results'),
      path.resolve('../results'),
      path.resolve('../../results'),
      path.resolve('../../../results'),
      // Fallback to current directory
      process.cwd()
    ];
    
    console.log(`🔍 Debug: Current working directory: ${process.cwd()}`);
    console.log(`🔍 Debug: __dirname equivalent: ${import.meta.url}`);
    
    // Try to find the main project directory by looking for package.json
    // We need to go up more levels to find the actual main project directory
    let mainProjectDir = null;
    let currentDir = process.cwd();
    for (let i = 0; i < 8; i++) { // Go up more levels to find main project
      const packageJsonPath = path.join(currentDir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        // Check if this is the main project by looking for specific files
        const hasMainFiles = fs.existsSync(path.join(currentDir, 'bot.js')) && 
                           fs.existsSync(path.join(currentDir, 'unified-scraper.js'));
        
        if (hasMainFiles) {
          mainProjectDir = currentDir;
          console.log(`🔍 Debug: Found main project directory: ${mainProjectDir}`);
          break;
        }
      }
      currentDir = path.join(currentDir, '..');
    }
    
    // If we found the main project directory, add its results path
    if (mainProjectDir) {
      const mainResultsPath = path.join(mainProjectDir, 'results');
      possiblePaths.unshift(mainResultsPath);
      console.log(`🔍 Debug: Added main project results path: ${mainResultsPath}`);
    }
    
    for (const testPath of possiblePaths) {
      try {
        console.log(`🔍 Debug: Testing path: ${testPath}`);
        if (fs.existsSync(testPath)) {
          resultsDir = testPath;
          console.log(`🔍 Debug: Found existing results directory: ${resultsDir}`);
          break;
        } else if (fs.existsSync(path.dirname(testPath))) {
          resultsDir = testPath;
          console.log(`🔍 Debug: Found parent directory, will create results: ${resultsDir}`);
          break;
        } else {
          console.log(`🔍 Debug: Path not accessible: ${testPath}`);
        }
      } catch (pathError) {
        console.log(`⚠️  Path check failed for ${testPath}: ${pathError.message}`);
        continue;
      }
    }
    
    if (!resultsDir) {
      // Create a simple path in current directory to avoid spaces
      resultsDir = path.join(process.cwd(), 'results');
      console.log(`🔍 Debug: Using simple results directory: ${resultsDir}`);
    }
    
    // Ensure the results directory exists
    try {
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
        console.log(`✅ Created results directory: ${resultsDir}`);
      }
      console.log(`🔍 Debug: Final results directory: ${resultsDir}`);
      console.log(`🔍 Debug: Directory exists: ${fs.existsSync(resultsDir)}`);
      console.log(`🔍 Debug: Directory writable: ${fs.accessSync ? 'checking...' : 'unknown'}`);
    } catch (dirError) {
      console.error(`❌ Failed to create/access results directory: ${dirError.message}`);
      // Fallback to current directory
      resultsDir = process.cwd();
      console.log(`🔍 Debug: Fallback to current directory: ${resultsDir}`);
    }
    
    // Ensure results directory exists
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
      console.log(`✅ Results directory created: ${resultsDir}`);
    }
    
    // Use provided filename if available, otherwise generate one from niche
    let finalFilename;
    if (providedFilename) {
      // Use the provided filename directly
      finalFilename = path.join(resultsDir, providedFilename);
      console.log(`🔍 Debug: Using provided filename: ${providedFilename}`);
    } else {
      // Generate filename from niche
      const cleanNiche = niche
        .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters but keep spaces
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .substring(0, 50); // Limit length to avoid path issues
      
      // Check if we have a session code from the LinkedIn wrapper
      const sessionCode = process.env.LINKEDIN_SESSION_CODE;
      if (sessionCode) {
        finalFilename = path.join(resultsDir, `${cleanNiche}_linkedin_results_SESSION_${sessionCode}.xlsx`);
        console.log(`🔍 Debug: Generated filename with session code: ${cleanNiche}_SESSION_${sessionCode}`);
      } else {
        finalFilename = path.join(resultsDir, `${cleanNiche}_linkedin_results_${timestamp}.xlsx`);
        console.log(`🔍 Debug: Generated filename from niche: ${cleanNiche}`);
      }
    }
    
    const filename = finalFilename;
    
    console.log(`📁 Saving to: ${filename}`);
    console.log(`🔍 Debug: resultsDir exists: ${fs.existsSync(resultsDir)}`);
    console.log(`🔍 Debug: resultsDir path: ${resultsDir}`);
    console.log(`🔍 Debug: Niche parameter: "${niche}"`);
    console.log(`🔍 Debug: Provided filename: "${providedFilename}"`);
    console.log(`🔍 Debug: Full filename: ${filename}`);
    
    // Ensure the directory exists again before saving
    if (!fs.existsSync(resultsDir)) {
      console.log(`📁 Creating results directory: ${resultsDir}`);
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Save file with error handling
    try {
      console.log(`🔍 Debug: About to call XLSX.writeFile...`);
      console.log(`🔍 Debug: Workbook has ${workbook.SheetNames.length} sheets`);
      console.log(`🔍 Debug: Worksheet ref: ${worksheet['!ref']}`);
      
      // Try to save to a simple filename first to test XLSX
      const testFilename = path.join(resultsDir, `test_linkedin_${timestamp}.xlsx`);
      console.log(`🔍 Debug: Testing with simple filename: ${testFilename}`);
      
      // Try multiple methods to save the file
      let fileSaved = false;
      
      // Method 1: Try writeFile
      try {
        XLSX.writeFile(workbook, testFilename);
        console.log(`✅ Test file created successfully with writeFile: ${testFilename}`);
        fileSaved = true;
      } catch (writeFileError) {
        console.log(`⚠️  writeFile failed: ${writeFileError.message}`);
      }
      
      // Method 2: Try writeFileSync
      if (!fileSaved) {
        try {
          XLSX.writeFileSync(workbook, testFilename);
          console.log(`✅ Test file created successfully with writeFileSync: ${testFilename}`);
          fileSaved = true;
        } catch (writeFileSyncError) {
          console.log(`⚠️  writeFileSync failed: ${writeFileSyncError.message}`);
        }
      }
      
      // Method 3: Try buffer approach
      if (!fileSaved) {
        try {
          const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
          fs.writeFileSync(testFilename, buffer);
          console.log(`✅ Test file created successfully with buffer method: ${testFilename}`);
          fileSaved = true;
        } catch (bufferError) {
          console.log(`⚠️  Buffer method failed: ${bufferError.message}`);
        }
      }
      
      if (!fileSaved) {
        // Last resort: try to save to a very simple path
        try {
          const simplePath = path.join(process.cwd(), 'linkedin_results.xlsx');
          console.log(`🔍 Debug: Last resort - trying simple path: ${simplePath}`);
          XLSX.writeFile(workbook, simplePath);
          console.log(`✅ LinkedIn Excel exported to simple path: ${simplePath}`);
          fileSaved = true;
          // Update filename to the simple path
          filename = simplePath;
        } catch (lastResortError) {
          console.error(`❌ Last resort save failed: ${lastResortError.message}`);
          
          // Try one more time with an even simpler approach
          try {
            const ultraSimplePath = 'linkedin_results.xlsx';
            console.log(`🔍 Debug: Ultra last resort - trying: ${ultraSimplePath}`);
            XLSX.writeFile(workbook, ultraSimplePath);
            console.log(`✅ LinkedIn Excel exported to ultra simple path: ${ultraSimplePath}`);
            fileSaved = true;
            filename = ultraSimplePath;
          } catch (ultraError) {
            console.error(`❌ Ultra last resort save failed: ${ultraError.message}`);
            throw new Error('All file saving methods failed');
          }
        }
      }
      
      // Now try the actual filename with the same method that worked
      if (fileSaved && filename !== path.join(process.cwd(), 'linkedin_results.xlsx')) {
        try {
          XLSX.writeFile(workbook, filename);
    console.log(`✅ LinkedIn Excel exported: ${filename}`);
        } catch (writeFileError) {
          console.log(`⚠️  writeFile failed for main file, trying buffer method: ${writeFileError.message}`);
          try {
            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            fs.writeFileSync(filename, buffer);
            console.log(`✅ LinkedIn Excel exported with buffer method: ${filename}`);
          } catch (bufferError) {
            console.log(`⚠️  Buffer method failed for main file, trying simple filename: ${bufferError.message}`);
            // Last resort: save with a simple name in current directory
            const simpleMainPath = path.join(process.cwd(), `linkedin_${timestamp}.xlsx`);
            XLSX.writeFile(workbook, simpleMainPath);
            console.log(`✅ LinkedIn Excel exported with simple filename: ${simpleMainPath}`);
            filename = simpleMainPath; // Update filename to the one that worked
          }
        }
      }
    
    // Verify file was created
      if (fs.existsSync(filename)) {
    const stats = fs.statSync(filename);
    console.log(`✅ File verified: ${filename} (${stats.size} bytes)`);
      } else {
        console.log(`❌ File was not created: ${filename}`);
      }
      
      // Clean up test file
      if (fs.existsSync(testFilename)) {
        fs.unlinkSync(testFilename);
        console.log(`🧹 Test file cleaned up`);
      }
    
    return filename;
    } catch (writeError) {
      console.error(`❌ XLSX.writeFile failed: ${writeError.message}`);
      console.error(`❌ Write error stack: ${writeError.stack}`);
      
      // Try to get more details about the error
      if (writeError.code) {
        console.error(`❌ Error code: ${writeError.code}`);
      }
      if (writeError.errno) {
        console.error(`❌ Error number: ${writeError.errno}`);
      }
      
      throw writeError;
    }
    
  } catch (error) {
    console.error(`❌ Error exporting LinkedIn to Excel: ${error.message}`);
    throw error;
  }
}

/**
 * Export results to Text format with descriptive header
 * @param {Array} results - Array of result objects
 * @param {string} filename - Output filename
 * @param {string} niche - Target niche for the header
 * @returns {Promise<string>} - Generated filename
 */
async function exportToText(results, filename, niche = '') {
  try {
    if (!results || results.length === 0) {
      console.log(chalk.yellow('⚠️  No results to export'));
      return null;
    }

    // Generate filename if not provided
    if (!filename) {
      const timestamp = Date.now();
      filename = `results_${timestamp}.txt`;
    }

    // Extract and deduplicate emails and phones
    const emails = results.filter(r => r.email && r.email.trim() !== '').map(r => r.email.toLowerCase().trim());
    const phones = results.filter(r => r.phone && r.phone.trim() !== '').map(r => r.phone.trim());
    
    // Remove duplicates using Set
    const uniqueEmails = [...new Set(emails)];
    const uniquePhones = [...new Set(phones)];
    
    // Sort for better readability
    uniqueEmails.sort();
    uniquePhones.sort();
    
    let content = '';
    
    if (uniqueEmails.length > 0 && uniquePhones.length > 0) {
      // Both emails and phones
      content = `Email and Phone Numbers Data for: ${niche}\n`;
      content += `Total Emails: ${uniqueEmails.length} | Total Phone Numbers: ${uniquePhones.length}\n`;
      content += `Generated on: ${new Date().toLocaleString()}\n`;
      content += `─`.repeat(60) + `\n\n`;
      
      content += `EMAILS:\n`;
      content += `─`.repeat(20) + `\n`;
      uniqueEmails.forEach(email => {
        content += `${email}\n`;
      });
      
      content += `\nPHONE NUMBERS:\n`;
      content += `─`.repeat(20) + `\n`;
      uniquePhones.forEach(phone => {
        content += `${phone}\n`;
      });
      
    } else if (uniqueEmails.length > 0) {
      // Only emails
      content = `Email Data for: ${niche}\n`;
      content += `Total Emails: ${uniqueEmails.length}\n`;
      content += `Generated on: ${new Date().toLocaleString()}\n`;
      content += `─`.repeat(60) + `\n\n`;
      
      content += `EMAILS:\n`;
      content += `─`.repeat(20) + `\n`;
      uniqueEmails.forEach(email => {
        content += `${email}\n`;
      });
      
    } else if (uniquePhones.length > 0) {
      // Only phones
      content = `Phone Numbers Data for: ${niche}\n`;
      content += `Total Phone Numbers: ${uniquePhones.length}\n`;
      content += `Generated on: ${new Date().toLocaleString()}\n`;
      content += `─`.repeat(60) + `\n\n`;
      
      content += `PHONE NUMBERS:\n`;
      content += `─`.repeat(20) + `\n`;
      uniquePhones.forEach(phone => {
        content += `${phone}\n`;
      });
    } else {
      content = `No contact information found for: ${niche}\n`;
      content += `Generated on: ${new Date().toLocaleString()}\n`;
    }

    // Write to file
    await fs.promises.writeFile(filename, content, 'utf8');
    console.log(chalk.green(`✅ Text file exported: ${filename}`));
    
    // Verify file was created
    const stats = await fs.promises.stat(filename);
    console.log(chalk.blue(`✅ File verified: ${filename} (${stats.size} bytes)`));
    
    return filename;
    
  } catch (error) {
    console.error(chalk.red(`❌ Text export failed: ${error.message}`));
    throw error;
  }
}

/**
 * Export results to CSV format
 * @param {Array} results - Array of result objects
 * @param {string} filename - Output filename
 * @returns {Promise<string>} - Generated filename
 */
async function exportToCsv(results, filename) {
  try {
    console.log(`💾 Saving ${results.length} validated results...`);
    
    // Create CSV content
    let csvContent = '';
    
    // Add headers
    if (results.length > 0) {
      const headers = Object.keys(results[0]);
      csvContent += headers.join(',') + '\n';
    }
    
    // Add data rows
    for (const result of results) {
      const row = Object.values(result).map(value => {
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      });
      csvContent += row.join(',') + '\n';
    }
    
    // Write to file
    fs.writeFileSync(filename, csvContent, 'utf8');
    
    console.log(`✅ CSV exported: ${filename}`);
    
    // Verify file was created
    const stats = fs.statSync(filename);
    console.log(`✅ File verified: ${filename} (${stats.size} bytes)`);
    
    return filename;
    
  } catch (error) {
    console.error(`❌ Error exporting to CSV: ${error.message}`);
    throw error;
  }
}

/**
 * Export results to Excel format
 * @param {Array} results - Array of result objects
 * @param {string} filename - Output filename
 * @returns {Promise<string>} - Generated filename
 */
async function exportToExcel(results, filename) {
  try {
    const XLSX = await import('xlsx');
    
    // Prepare data for Excel
    const excelData = results.map(result => ({
      Email: result.email || '',
      Phone: result.phone || ''
    }));
    
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
    
    // Write to file
    XLSX.writeFile(workbook, filename);
    
    console.log(chalk.green(`✅ Excel exported: ${filename}`));
    return filename;
    
  } catch (error) {
    console.error(chalk.red(`❌ Excel export failed: ${error.message}`));
    throw error;
  }
}

/**
 * Export multi-source results (legacy function)
 * @param {Array} allResults - Array of all results
 * @param {string} format - Export format ('csv' or 'xlsx')
 * @param {string} filename - Output filename
 * @returns {Promise<string>} - Generated filename
 */
export async function exportMultiSourceResults(allResults, format = 'csv', filename = null) {
  try {
    if (!allResults || allResults.length === 0) {
      console.log(chalk.yellow('⚠️  No results to export'));
      return null;
    }

    // Generate filename if not provided
    if (!filename) {
      const timestamp = Date.now();
      filename = format === 'xlsx' ? `multi_source_results_${timestamp}.xlsx` : `multi_source_results_${timestamp}.csv`;
    }

    if (format === 'xlsx') {
      return await exportMultiSourceToExcel(allResults, filename);
    } else {
      return await exportMultiSourceToCsv(allResults, filename);
    }

  } catch (error) {
    console.error(chalk.red(`❌ Multi-source export failed: ${error.message}`));
    throw error;
  }
}

/**
 * Export multi-source results to CSV
 * @param {Array} allResults - Array of all results
 * @param {string} filename - Output filename
 * @returns {Promise<string>} - Generated filename
 */
async function exportMultiSourceToCsv(allResults, filename) {
  try {
    const fs = await import('fs/promises');
    
    // Create CSV header
    const headers = ['Email', 'Phone', 'Source', 'URL', 'Query'];
    const csvHeader = headers.join(',') + '\n';
    
    // Create CSV rows
    const csvRows = allResults.map(result => {
      const email = result.email || '';
      const phone = result.phone || '';
      const source = result.source || '';
      const url = result.url || '';
      const query = result.query || '';
      
      return `"${email}","${phone}","${source}","${url}","${query}"`;
    });
    
    const csvContent = csvHeader + csvRows.join('\n');
    
    // Write to file
    await fs.writeFile(filename, csvContent, 'utf8');
    
    console.log(chalk.green(`✅ Multi-source CSV exported: ${filename}`));
    return filename;
    
  } catch (error) {
    console.error(chalk.red(`❌ Multi-source CSV export failed: ${error.message}`));
    throw error;
  }
}

/**
 * Export multi-source results to Excel
 * @param {Array} allResults - Array of all results
 * @param {string} filename - Output filename
 * @returns {Promise<string>} - Generated filename
 */
async function exportMultiSourceToExcel(allResults, filename) {
  try {
    const XLSX = await import('xlsx');
    
    // Prepare data for Excel
    const excelData = allResults.map(result => ({
      Email: result.email || '',
      Phone: result.phone || '',
      Source: result.source || '',
      URL: result.url || '',
      Query: result.query || ''
    }));
    
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Multi-Source Results');
    
    // Write to file
    XLSX.writeFile(workbook, filename);
    
    console.log(chalk.green(`✅ Multi-source Excel exported: ${filename}`));
    return filename;
    
  } catch (error) {
    console.error(chalk.red(`❌ Multi-source Excel export failed: ${error.message}`));
    throw error;
  }
} 