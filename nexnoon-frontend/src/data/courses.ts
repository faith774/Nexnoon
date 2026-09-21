// Comprehensive course data for all 15 categories
// 20 courses per category = 300 total courses

export interface Course {
  id: number;
  title: string;
  instructor: string;
  location: string;
  date: string;
  time: string;
  participants: number;
  price: number;
  category: string;
  image: string;
}

export const allCourses: Course[] = [
  // Development (20 courses)
  { id: 1, title: "Advanced React Patterns & Best Practices", instructor: "Sarah Johnson", location: "Online, Live", date: "Jan 22, 2026", time: "2:00 PM EST", participants: 124, price: 89.99, category: "Development", image: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800" },
  { id: 2, title: "Full Stack JavaScript Development", instructor: "Tyler Greene", location: "Online, Live", date: "Jan 30, 2026", time: "2:00 PM EST", participants: 139, price: 129.99, category: "Development", image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800" },
  { id: 3, title: "Mobile App Development with Flutter", instructor: "Kevin Park", location: "Online, Live", date: "Jan 28, 2026", time: "1:00 PM EST", participants: 118, price: 109.99, category: "Development", image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800" },
  { id: 4, title: "Node.js Backend Development", instructor: "Marcus Developer", location: "Online, Live", date: "Feb 1, 2026", time: "3:00 PM EST", participants: 95, price: 99.99, category: "Development", image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800" },
  { id: 5, title: "Python Django Web Framework", instructor: "Lisa Code", location: "Online, Live", date: "Feb 2, 2026", time: "1:00 PM EST", participants: 102, price: 94.99, category: "Development", image: "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=800" },
  { id: 6, title: "Vue.js Complete Guide", instructor: "Alex Frontend", location: "Online, Live", date: "Feb 3, 2026", time: "4:00 PM EST", participants: 87, price: 84.99, category: "Development", image: "https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=800" },
  { id: 7, title: "Angular Enterprise Development", instructor: "Jennifer Tech", location: "Online, Live", date: "Feb 4, 2026", time: "10:00 AM EST", participants: 76, price: 119.99, category: "Development", image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800" },
  { id: 8, title: "GraphQL API Development", instructor: "Robert Query", location: "Online, Live", date: "Feb 5, 2026", time: "2:00 PM EST", participants: 91, price: 109.99, category: "Development", image: "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=800" },
  { id: 9, title: "TypeScript Mastery", instructor: "Emma Types", location: "Online, Live", date: "Feb 6, 2026", time: "11:00 AM EST", participants: 104, price: 89.99, category: "Development", image: "https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800" },
  { id: 10, title: "Next.js Full Stack Apps", instructor: "David Modern", location: "Online, Live", date: "Feb 7, 2026", time: "3:00 PM EST", participants: 112, price: 124.99, category: "Development", image: "https://images.unsplash.com/photo-1593720213428-28a5b9e94613?w=800" },
  { id: 11, title: "MongoDB Database Design", instructor: "Sarah DB", location: "Online, Live", date: "Feb 8, 2026", time: "9:00 AM EST", participants: 88, price: 79.99, category: "Development", image: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800" },
  { id: 12, title: "Docker & Kubernetes for Developers", instructor: "Michael Container", location: "Online, Live", date: "Feb 9, 2026", time: "1:00 PM EST", participants: 97, price: 134.99, category: "Development", image: "https://images.unsplash.com/photo-1605745341112-85968b19335b?w=800" },
  { id: 13, title: "Git & GitHub Workflows", instructor: "Chris Version", location: "Online, Live", date: "Feb 10, 2026", time: "4:00 PM EST", participants: 145, price: 49.99, category: "Development", image: "https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=800" },
  { id: 14, title: "REST API Best Practices", instructor: "Linda Backend", location: "Online, Live", date: "Feb 11, 2026", time: "10:00 AM EST", participants: 101, price: 89.99, category: "Development", image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800" },
  { id: 15, title: "React Native Mobile Apps", instructor: "James Mobile", location: "Online, Live", date: "Feb 12, 2026", time: "2:00 PM EST", participants: 93, price: 114.99, category: "Development", image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800" },
  { id: 16, title: "Laravel PHP Framework", instructor: "Patricia PHP", location: "Online, Live", date: "Feb 13, 2026", time: "11:00 AM EST", participants: 82, price: 94.99, category: "Development", image: "https://images.unsplash.com/photo-1599507593499-a3f7d7d97667?w=800" },
  { id: 17, title: "Ruby on Rails Development", instructor: "Thomas Rails", location: "Online, Live", date: "Feb 14, 2026", time: "3:00 PM EST", participants: 74, price: 99.99, category: "Development", image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800" },
  { id: 18, title: "Spring Boot Java", instructor: "Nancy Java", location: "Online, Live", date: "Feb 15, 2026", time: "9:00 AM EST", participants: 86, price: 119.99, category: "Development", image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800" },
  { id: 19, title: "Svelte Framework Complete", instructor: "Kevin Svelte", location: "Online, Live", date: "Feb 16, 2026", time: "1:00 PM EST", participants: 69, price: 89.99, category: "Development", image: "https://images.unsplash.com/photo-1619410283995-43d9134e7656?w=800" },
  { id: 20, title: "Microservices Architecture", instructor: "Rachel Architect", location: "Online, Live", date: "Feb 17, 2026", time: "4:00 PM EST", participants: 91, price: 144.99, category: "Development", image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800" },

  // Design (20 courses)
  { id: 21, title: "UI/UX Design Fundamentals", instructor: "Michael Chen", location: "Online, Live", date: "Jan 22, 2026", time: "4:00 PM EST", participants: 98, price: 79.99, category: "Design", image: "https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=800" },
  { id: 22, title: "Graphic Design with Adobe Creative Suite", instructor: "Rachel Kim", location: "Online, Live", date: "Jan 26, 2026", time: "2:30 PM EST", participants: 108, price: 84.99, category: "Design", image: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800" },
  { id: 23, title: "Brand Identity Design", instructor: "Olivia Reed", location: "Online, Live", date: "Jan 31, 2026", time: "4:00 PM EST", participants: 88, price: 79.99, category: "Design", image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800" },
  { id: 24, title: "Motion Graphics with After Effects", instructor: "Diana Lopez", location: "Online, Live", date: "Feb 4, 2026", time: "3:00 PM EST", participants: 94, price: 94.99, category: "Design", image: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800" },
  { id: 25, title: "Figma UI Design Complete", instructor: "Steven Designer", location: "Online, Live", date: "Feb 5, 2026", time: "10:00 AM EST", participants: 115, price: 74.99, category: "Design", image: "https://images.unsplash.com/photo-1561070791-36c11767b26a?w=800" },
  { id: 26, title: "Adobe XD Prototyping", instructor: "Maria Proto", location: "Online, Live", date: "Feb 6, 2026", time: "2:00 PM EST", participants: 92, price: 69.99, category: "Design", image: "https://images.unsplash.com/photo-1558655146-d09347e92766?w=800" },
  { id: 27, title: "Web Design for Beginners", instructor: "Paul Web", location: "Online, Live", date: "Feb 7, 2026", time: "11:00 AM EST", participants: 127, price: 59.99, category: "Design", image: "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=800" },
  { id: 28, title: "Typography Mastery", instructor: "Laura Type", location: "Online, Live", date: "Feb 8, 2026", time: "3:00 PM EST", participants: 76, price: 64.99, category: "Design", image: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800" },
  { id: 29, title: "Color Theory for Designers", instructor: "Brian Color", location: "Online, Live", date: "Feb 9, 2026", time: "9:00 AM EST", participants: 103, price: 54.99, category: "Design", image: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800" },
  { id: 30, title: "Illustration with Procreate", instructor: "Amanda Art", location: "Online, Live", date: "Feb 10, 2026", time: "1:00 PM EST", participants: 89, price: 79.99, category: "Design", image: "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=800" },
  { id: 31, title: "Logo Design Workshop", instructor: "Derek Logo", location: "Online, Live", date: "Feb 11, 2026", time: "4:00 PM EST", participants: 95, price: 69.99, category: "Design", image: "https://images.unsplash.com/photo-1626785774625-0a58e17fcf8f?w=800" },
  { id: 32, title: "User Research Methods", instructor: "Nicole Research", location: "Online, Live", date: "Feb 12, 2026", time: "10:00 AM EST", participants: 84, price: 89.99, category: "Design", image: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800" },
  { id: 33, title: "Interaction Design Principles", instructor: "Gregory UX", location: "Online, Live", date: "Feb 13, 2026", time: "2:00 PM EST", participants: 91, price: 84.99, category: "Design", image: "https://images.unsplash.com/photo-1559028012-481c04fa702d?w=800" },
  { id: 34, title: "Mobile App UI Design", instructor: "Samantha Mobile", location: "Online, Live", date: "Feb 14, 2026", time: "11:00 AM EST", participants: 107, price: 79.99, category: "Design", image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800" },
  { id: 35, title: "Design Systems Creation", instructor: "Marcus System", location: "Online, Live", date: "Feb 15, 2026", time: "3:00 PM EST", participants: 73, price: 99.99, category: "Design", image: "https://images.unsplash.com/photo-1558655146-364adaf1fcc9?w=800" },
  { id: 36, title: "3D Design with Blender", instructor: "Victoria 3D", location: "Online, Live", date: "Feb 16, 2026", time: "9:00 AM EST", participants: 82, price: 109.99, category: "Design", image: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800" },
  { id: 37, title: "Packaging Design", instructor: "Henry Package", location: "Online, Live", date: "Feb 17, 2026", time: "1:00 PM EST", participants: 68, price: 74.99, category: "Design", image: "https://images.unsplash.com/photo-1561070791-36c11767b26a?w=800" },
  { id: 38, title: "Sketch App Mastery", instructor: "Melissa Sketch", location: "Online, Live", date: "Feb 18, 2026", time: "4:00 PM EST", participants: 79, price: 69.99, category: "Design", image: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800" },
  { id: 39, title: "Print Design Essentials", instructor: "George Print", location: "Online, Live", date: "Feb 19, 2026", time: "10:00 AM EST", participants: 71, price: 64.99, category: "Design", image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800" },
  { id: 40, title: "Icon Design Workshop", instructor: "Sofia Icon", location: "Online, Live", date: "Feb 20, 2026", time: "2:00 PM EST", participants: 85, price: 59.99, category: "Design", image: "https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=800" },

  // Marketing (20 courses)
  { id: 41, title: "Digital Marketing Strategy 2026", instructor: "Emma Williams", location: "Online, Live", date: "Jan 23, 2026", time: "1:00 PM EST", participants: 156, price: 99.99, category: "Marketing", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800" },
  { id: 42, title: "SEO & Content Marketing Mastery", instructor: "Brian Cooper", location: "Online, Live", date: "Jan 27, 2026", time: "12:00 PM EST", participants: 164, price: 89.99, category: "Marketing", image: "https://images.unsplash.com/photo-1432888622747-4eb9a8f2c293?w=800" },
  { id: 43, title: "Social Media Marketing Strategy", instructor: "Hannah Scott", location: "Online, Live", date: "Jan 31, 2026", time: "6:00 PM EST", participants: 174, price: 89.99, category: "Marketing", image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800" },
  { id: 44, title: "Email Marketing Campaigns", instructor: "Daniel Email", location: "Online, Live", date: "Feb 1, 2026", time: "10:00 AM EST", participants: 132, price: 74.99, category: "Marketing", image: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800" },
  { id: 45, title: "Facebook Ads Mastery", instructor: "Jessica Ads", location: "Online, Live", date: "Feb 2, 2026", time: "2:00 PM EST", participants: 147, price: 94.99, category: "Marketing", image: "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=800" },
  { id: 46, title: "Google Ads Complete Guide", instructor: "Ryan Google", location: "Online, Live", date: "Feb 3, 2026", time: "11:00 AM EST", participants: 138, price: 99.99, category: "Marketing", image: "https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?w=800" },
  { id: 47, title: "Instagram Marketing Success", instructor: "Sophia Insta", location: "Online, Live", date: "Feb 4, 2026", time: "3:00 PM EST", participants: 165, price: 79.99, category: "Marketing", image: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=800" },
  { id: 48, title: "YouTube Marketing & Growth", instructor: "Tyler Video", location: "Online, Live", date: "Feb 5, 2026", time: "9:00 AM EST", participants: 142, price: 89.99, category: "Marketing", image: "https://images.unsplash.com/photo-1611162618479-ee3d24aaef0b?w=800" },
  { id: 49, title: "Content Strategy Blueprint", instructor: "Megan Content", location: "Online, Live", date: "Feb 6, 2026", time: "1:00 PM EST", participants: 119, price: 84.99, category: "Marketing", image: "https://images.unsplash.com/photo-1542435503-956c469947f6?w=800" },
  { id: 50, title: "Influencer Marketing Tactics", instructor: "Brandon Influence", location: "Online, Live", date: "Feb 7, 2026", time: "4:00 PM EST", participants: 128, price: 94.99, category: "Marketing", image: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=800" },
  { id: 51, title: "Marketing Analytics & Metrics", instructor: "Catherine Data", location: "Online, Live", date: "Feb 8, 2026", time: "10:00 AM EST", participants: 115, price: 99.99, category: "Marketing", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800" },
  { id: 52, title: "Growth Hacking Strategies", instructor: "Alex Growth", location: "Online, Live", date: "Feb 9, 2026", time: "2:00 PM EST", participants: 153, price: 109.99, category: "Marketing", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800" },
  { id: 53, title: "Conversion Rate Optimization", instructor: "Monica Convert", location: "Online, Live", date: "Feb 10, 2026", time: "11:00 AM EST", participants: 134, price: 89.99, category: "Marketing", image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800" },
  { id: 54, title: "Marketing Automation", instructor: "Peter Auto", location: "Online, Live", date: "Feb 11, 2026", time: "3:00 PM EST", participants: 108, price: 104.99, category: "Marketing", image: "https://images.unsplash.com/photo-1556155092-490a1ba16284?w=800" },
  { id: 55, title: "TikTok Marketing Trends", instructor: "Isabella Viral", location: "Online, Live", date: "Feb 12, 2026", time: "9:00 AM EST", participants: 187, price: 74.99, category: "Marketing", image: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=800" },
  { id: 56, title: "LinkedIn B2B Marketing", instructor: "Jonathan B2B", location: "Online, Live", date: "Feb 13, 2026", time: "1:00 PM EST", participants: 96, price: 94.99, category: "Marketing", image: "https://images.unsplash.com/photo-1611944212129-29977ae1398c?w=800" },
  { id: 57, title: "Copywriting for Marketers", instructor: "Natalie Words", location: "Online, Live", date: "Feb 14, 2026", time: "4:00 PM EST", participants: 146, price: 79.99, category: "Marketing", image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800" },
  { id: 58, title: "Brand Positioning Strategy", instructor: "Marcus Brand", location: "Online, Live", date: "Feb 15, 2026", time: "10:00 AM EST", participants: 103, price: 99.99, category: "Marketing", image: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800" },
  { id: 59, title: "Public Relations Fundamentals", instructor: "Vanessa PR", location: "Online, Live", date: "Feb 16, 2026", time: "2:00 PM EST", participants: 87, price: 84.99, category: "Marketing", image: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800" },
  { id: 60, title: "Affiliate Marketing Success", instructor: "Oscar Affiliate", location: "Online, Live", date: "Feb 17, 2026", time: "11:00 AM EST", participants: 121, price: 89.99, category: "Marketing", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800" },

  // Business (20 courses) 
  { id: 61, title: "Business Analytics & Data Insights", instructor: "David Martinez", location: "Online, Live", date: "Jan 23, 2026", time: "3:00 PM EST", participants: 87, price: 94.99, category: "Business", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800" },
  { id: 62, title: "Entrepreneurship Fundamentals", instructor: "Patricia Wong", location: "Online, Live", date: "Jan 27, 2026", time: "5:00 PM EST", participants: 91, price: 99.99, category: "Business", image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800" },
  { id: 63, title: "Leadership & Team Management", instructor: "Robert Shaw", location: "Online, Live", date: "Jan 30, 2026", time: "9:00 AM EST", participants: 103, price: 94.99, category: "Business", image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800" },
  { id: 64, title: "Financial Planning for Startups", instructor: "George Miller", location: "Online, Live", date: "Feb 1, 2026", time: "10:00 AM EST", participants: 97, price: 99.99, category: "Business", image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800" },
  { id: 65, title: "Project Management Professional", instructor: "Diana PM", location: "Online, Live", date: "Feb 2, 2026", time: "11:00 AM EST", participants: 124, price: 119.99, category: "Business", image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800" },
  { id: 66, title: "Business Model Innovation", instructor: "Steven Strategy", location: "Online, Live", date: "Feb 3, 2026", time: "2:00 PM EST", participants: 86, price: 104.99, category: "Business", image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800" },
  { id: 67, title: "Strategic Planning Workshop", instructor: "Angela Plan", location: "Online, Live", date: "Feb 4, 2026", time: "10:00 AM EST", participants: 79, price: 94.99, category: "Business", image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800" },
  { id: 68, title: "Human Resources Management", instructor: "Thomas HR", location: "Online, Live", date: "Feb 5, 2026", time: "3:00 PM EST", participants: 92, price: 89.99, category: "Business", image: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800" },
  { id: 69, title: "Sales Strategy & Techniques", instructor: "Jennifer Sales", location: "Online, Live", date: "Feb 6, 2026", time: "1:00 PM EST", participants: 115, price: 99.99, category: "Business", image: "https://images.unsplash.com/photo-1556761175-4b46a572b786?w=800" },
  { id: 70, title: "Business Communication Skills", instructor: "Michael Comm", location: "Online, Live", date: "Feb 7, 2026", time: "9:00 AM EST", participants: 108, price: 74.99, category: "Business", image: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800" },
  { id: 71, title: "Negotiation Mastery", instructor: "Laura Deal", location: "Online, Live", date: "Feb 8, 2026", time: "2:00 PM EST", participants: 94, price: 89.99, category: "Business", image: "https://images.unsplash.com/photo-1556740758-90de374c12ad?w=800" },
  { id: 72, title: "Operations Management", instructor: "Patrick Ops", location: "Online, Live", date: "Feb 9, 2026", time: "11:00 AM EST", participants: 81, price: 94.99, category: "Business", image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800" },
  { id: 73, title: "Supply Chain Excellence", instructor: "Rachel Chain", location: "Online, Live", date: "Feb 10, 2026", time: "3:00 PM EST", participants: 73, price: 99.99, category: "Business", image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800" },
  { id: 74, title: "Business Ethics & Corporate Governance", instructor: "Dr. William Ethics", location: "Online, Live", date: "Feb 11, 2026", time: "10:00 AM EST", participants: 68, price: 84.99, category: "Business", image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800" },
  { id: 75, title: "Change Management", instructor: "Victoria Change", location: "Online, Live", date: "Feb 12, 2026", time: "1:00 PM EST", participants: 89, price: 94.99, category: "Business", image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800" },
  { id: 76, title: "International Business Strategy", instructor: "Carlos Global", location: "Online, Live", date: "Feb 13, 2026", time: "4:00 PM EST", participants: 71, price: 109.99, category: "Business", image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800" },
  { id: 77, title: "Customer Relationship Management", instructor: "Emily CRM", location: "Online, Live", date: "Feb 14, 2026", time: "9:00 AM EST", participants: 97, price: 89.99, category: "Business", image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800" },
  { id: 78, title: "Risk Management Essentials", instructor: "Brian Risk", location: "Online, Live", date: "Feb 15, 2026", time: "2:00 PM EST", participants: 76, price: 99.99, category: "Business", image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800" },
  { id: 79, title: "Quality Management Systems", instructor: "Nancy Quality", location: "Online, Live", date: "Feb 16, 2026", time: "11:00 AM EST", participants: 64, price: 94.99, category: "Business", image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800" },
  { id: 80, title: "Franchise Business Models", instructor: "Kevin Franchise", location: "Online, Live", date: "Feb 17, 2026", time: "3:00 PM EST", participants: 58, price: 104.99, category: "Business", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800" },

  // Technology (20 courses)
  { id: 81, title: "Cloud Computing with AWS", instructor: "Nathan Brooks", location: "Online, Live", date: "Feb 1, 2026", time: "1:00 PM EST", participants: 115, price: 114.99, category: "Technology", image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800" },
  { id: 82, title: "Cybersecurity Essentials", instructor: "Thomas Anderson", location: "Online, Live", date: "Feb 5, 2026", time: "10:00 AM EST", participants: 135, price: 119.99, category: "Technology", image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800" },
  { id: 83, title: "Azure Cloud Platform", instructor: "Michelle Cloud", location: "Online, Live", date: "Feb 2, 2026", time: "2:00 PM EST", participants: 102, price: 109.99, category: "Technology", image: "https://images.unsplash.com/photo-1523726491678-bf852e717f6a?w=800" },
  { id: 84, title: "Blockchain Technology", instructor: "Daniel Block", location: "Online, Live", date: "Feb 3, 2026", time: "3:00 PM EST", participants: 98, price: 124.99, category: "Technology", image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800" },
  { id: 85, title: "Internet of Things (IoT)", instructor: "Amanda IoT", location: "Online, Live", date: "Feb 4, 2026", time: "11:00 AM EST", participants: 87, price: 99.99, category: "Technology", image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800" },
  { id: 86, title: "Artificial Intelligence Basics", instructor: "Dr. Eric AI", location: "Online, Live", date: "Feb 5, 2026", time: "1:00 PM EST", participants: 142, price: 134.99, category: "Technology", image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800" },
  { id: 87, title: "Network Engineering", instructor: "Craig Network", location: "Online, Live", date: "Feb 6, 2026", time: "10:00 AM EST", participants: 79, price: 104.99, category: "Technology", image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800" },
  { id: 88, title: "Linux System Administration", instructor: "Gregory Linux", location: "Online, Live", date: "Feb 7, 2026", time: "2:00 PM EST", participants: 91, price: 94.99, category: "Technology", image: "https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=800" },
  { id: 89, title: "DevOps Engineering", instructor: "Samantha DevOps", location: "Online, Live", date: "Feb 8, 2026", time: "9:00 AM EST", participants: 106, price: 119.99, category: "Technology", image: "https://images.unsplash.com/photo-1605745341112-85968b19335b?w=800" },
  { id: 90, title: "Quantum Computing Intro", instructor: "Dr. Marcus Quantum", location: "Online, Live", date: "Feb 9, 2026", time: "3:00 PM EST", participants: 64, price: 144.99, category: "Technology", image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800" },
  { id: 91, title: "5G Technology", instructor: "Victoria 5G", location: "Online, Live", date: "Feb 10, 2026", time: "11:00 AM EST", participants: 71, price: 89.99, category: "Technology", image: "https://images.unsplash.com/photo-1551808525-51a94da548ce?w=800" },
  { id: 92, title: "Edge Computing", instructor: "Henry Edge", location: "Online, Live", date: "Feb 11, 2026", time: "1:00 PM EST", participants: 58, price: 99.99, category: "Technology", image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800" },
  { id: 93, title: "Big Data Technologies", instructor: "Melissa Data", location: "Online, Live", date: "Feb 12, 2026", time: "10:00 AM EST", participants: 94, price: 109.99, category: "Technology", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800" },
  { id: 94, title: "Penetration Testing", instructor: "George Security", location: "Online, Live", date: "Feb 13, 2026", time: "2:00 PM EST", participants: 103, price: 129.99, category: "Technology", image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800" },
  { id: 95, title: "Virtual Reality Development", instructor: "Sofia VR", location: "Online, Live", date: "Feb 14, 2026", time: "9:00 AM EST", participants: 76, price: 124.99, category: "Technology", image: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=800" },
  { id: 96, title: "Augmented Reality Apps", instructor: "Jason AR", location: "Online, Live", date: "Feb 15, 2026", time: "3:00 PM EST", participants: 68, price: 119.99, category: "Technology", image: "https://images.unsplash.com/photo-1617802690658-1173a812650d?w=800" },
  { id: 97, title: "IT Service Management", instructor: "Christine ITSM", location: "Online, Live", date: "Feb 16, 2026", time: "11:00 AM EST", participants: 82, price: 94.99, category: "Technology", image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800" },
  { id: 98, title: "Database Administration", instructor: "Leonard DB", location: "Online, Live", date: "Feb 17, 2026", time: "1:00 PM EST", participants: 89, price: 99.99, category: "Technology", image: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800" },
  { id: 99, title: "Computer Vision Fundamentals", instructor: "Dr. Alice Vision", location: "Online, Live", date: "Feb 18, 2026", time: "10:00 AM EST", participants: 72, price: 134.99, category: "Technology", image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800" },
  { id: 100, title: "Robotics Programming", instructor: "Timothy Robot", location: "Online, Live", date: "Feb 19, 2026", time: "2:00 PM EST", participants: 63, price: 139.99, category: "Technology", image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800" },

  // Photography (20 courses)
  { id: 101, title: "Photography Masterclass: Lighting", instructor: "Lisa Anderson", location: "Online, Live", date: "Jan 24, 2026", time: "11:00 AM EST", participants: 112, price: 69.99, category: "Photography", image: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800" },
  { id: 102, title: "Portrait Photography Techniques", instructor: "Jennifer Blake", location: "Online, Live", date: "Jan 28, 2026", time: "3:30 PM EST", participants: 95, price: 74.99, category: "Photography", image: "https://images.unsplash.com/photo-1554080353-a576cf803bda?w=800" },
  { id: 103, title: "Landscape Photography Adventure", instructor: "Megan Turner", location: "Online, Live", date: "Feb 2, 2026", time: "8:00 AM EST", participants: 101, price: 69.99, category: "Photography", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800" },
  { id: 104, title: "Street Photography Essentials", instructor: "Anthony Street", location: "Online, Live", date: "Feb 3, 2026", time: "4:00 PM EST", participants: 87, price: 64.99, category: "Photography", image: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800" },
  { id: 105, title: "Wedding Photography Business", instructor: "Christina Wedding", location: "Online, Live", date: "Feb 4, 2026", time: "1:00 PM EST", participants: 79, price: 89.99, category: "Photography", image: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800" },
  { id: 106, title: "Product Photography Studio", instructor: "Ryan Product", location: "Online, Live", date: "Feb 5, 2026", time: "10:00 AM EST", participants: 92, price: 79.99, category: "Photography", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800" },
  { id: 107, title: "Wildlife Photography", instructor: "Derek Nature", location: "Online, Live", date: "Feb 6, 2026", time: "9:00 AM EST", participants: 84, price: 74.99, category: "Photography", image: "https://images.unsplash.com/photo-1549366021-9f761d450615?w=800" },
  { id: 108, title: "Food Photography Styling", instructor: "Isabella Food", location: "Online, Live", date: "Feb 7, 2026", time: "2:00 PM EST", participants: 103, price: 69.99, category: "Photography", image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800" },
  { id: 109, title: "Macro Photography", instructor: "Peter Macro", location: "Online, Live", date: "Feb 8, 2026", time: "11:00 AM EST", participants: 68, price: 74.99, category: "Photography", image: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800" },
  { id: 110, title: "Night Photography Mastery", instructor: "Monica Night", location: "Online, Live", date: "Feb 9, 2026", time: "7:00 PM EST", participants: 76, price: 79.99, category: "Photography", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800" },
  { id: 111, title: "Adobe Lightroom Complete", instructor: "Jonathan Edit", location: "Online, Live", date: "Feb 10, 2026", time: "1:00 PM EST", participants: 118, price: 74.99, category: "Photography", image: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800" },
  { id: 112, title: "Drone Photography & Videography", instructor: "Marcus Drone", location: "Online, Live", date: "Feb 11, 2026", time: "10:00 AM EST", participants: 95, price: 99.99, category: "Photography", image: "https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=800" },
  { id: 113, title: "Black & White Photography", instructor: "Vanessa BW", location: "Online, Live", date: "Feb 12, 2026", time: "3:00 PM EST", participants: 71, price: 64.99, category: "Photography", image: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=800" },
  { id: 114, title: "Fashion Photography", instructor: "Oscar Fashion", location: "Online, Live", date: "Feb 13, 2026", time: "2:00 PM EST", participants: 88, price: 89.99, category: "Photography", image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800" },
  { id: 115, title: "Real Estate Photography", instructor: "Laura Estate", location: "Online, Live", date: "Feb 14, 2026", time: "9:00 AM EST", participants: 82, price: 79.99, category: "Photography", image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800" },
  { id: 116, title: "Sports Photography Action", instructor: "Brandon Sports", location: "Online, Live", date: "Feb 15, 2026", time: "11:00 AM EST", participants: 73, price: 84.99, category: "Photography", image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800" },
  { id: 117, title: "Travel Photography", instructor: "Catherine Travel", location: "Online, Live", date: "Feb 16, 2026", time: "4:00 PM EST", participants: 97, price: 69.99, category: "Photography", image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800" },
  { id: 118, title: "Photoshop for Photographers", instructor: "Alex Retouch", location: "Online, Live", date: "Feb 17, 2026", time: "1:00 PM EST", participants: 124, price: 79.99, category: "Photography", image: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800" },
  { id: 119, title: "Studio Lighting Setup", instructor: "Gregory Studio", location: "Online, Live", date: "Feb 18, 2026", time: "10:00 AM EST", participants: 86, price: 74.99, category: "Photography", image: "https://images.unsplash.com/photo-1606925797300-0b35e9d1794e?w=800" },
  { id: 120, title: "Photography Business Marketing", instructor: "Natalie Biz", location: "Online, Live", date: "Feb 19, 2026", time: "2:00 PM EST", participants: 79, price: 84.99, category: "Photography", image: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800" },

  // Music (20 courses)
  { id: 121, title: "Music Production: Beginner to Pro", instructor: "James Taylor", location: "Online, Live", date: "Jan 24, 2026", time: "5:00 PM EST", participants: 93, price: 109.99, category: "Music", image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800" },
  { id: 122, title: "Guitar Fundamentals for Beginners", instructor: "Marcus Thompson", location: "Online, Live", date: "Jan 29, 2026", time: "7:00 PM EST", participants: 82, price: 64.99, category: "Music", image: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800" },
  { id: 123, title: "Electronic Music Production", instructor: "Alex Rivera", location: "Online, Live", date: "Feb 2, 2026", time: "7:00 PM EST", participants: 89, price: 99.99, category: "Music", image: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=800" },
  { id: 124, title: "Piano for Beginners", instructor: "Emma Keys", location: "Online, Live", date: "Feb 3, 2026", time: "6:00 PM EST", participants: 107, price: 69.99, category: "Music", image: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=800" },
  { id: 125, title: "Drums & Percussion", instructor: "Daniel Beats", location: "Online, Live", date: "Feb 4, 2026", time: "7:00 PM EST", participants: 71, price: 74.99, category: "Music", image: "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=800" },
  { id: 126, title: "Vocal Training & Singing", instructor: "Jessica Voice", location: "Online, Live", date: "Feb 5, 2026", time: "5:00 PM EST", participants: 112, price: 79.99, category: "Music", image: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800" },
  { id: 127, title: "Music Theory Essentials", instructor: "Dr. Ryan Theory", location: "Online, Live", date: "Feb 6, 2026", time: "6:00 PM EST", participants: 94, price: 64.99, category: "Music", image: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=800" },
  { id: 128, title: "DJ & Mixing Masterclass", instructor: "Tyler DJ", location: "Online, Live", date: "Feb 7, 2026", time: "8:00 PM EST", participants: 86, price: 99.99, category: "Music", image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800" },
  { id: 129, title: "Songwriting Workshop", instructor: "Megan Lyrics", location: "Online, Live", date: "Feb 8, 2026", time: "5:00 PM EST", participants: 98, price: 74.99, category: "Music", image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800" },
  { id: 130, title: "Bass Guitar Complete", instructor: "Brandon Bass", location: "Online, Live", date: "Feb 9, 2026", time: "6:00 PM EST", participants: 68, price: 69.99, category: "Music", image: "https://images.unsplash.com/photo-1556449895-a33c9dba33dd?w=800" },
  { id: 131, title: "Violin Basics", instructor: "Catherine Strings", location: "Online, Live", date: "Feb 10, 2026", time: "7:00 PM EST", participants: 76, price: 74.99, category: "Music", image: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=800" },
  { id: 132, title: "Audio Engineering & Mixing", instructor: "Peter Sound", location: "Online, Live", date: "Feb 11, 2026", time: "5:00 PM EST", participants: 103, price: 109.99, category: "Music", image: "https://images.unsplash.com/photo-1598653222000-6b7b7a552625?w=800" },
  { id: 133, title: "Music Composition", instructor: "Monica Composer", location: "Online, Live", date: "Feb 12, 2026", time: "6:00 PM EST", participants: 82, price: 89.99, category: "Music", image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800" },
  { id: 134, title: "Hip Hop Beat Making", instructor: "Jonathan Beats", location: "Online, Live", date: "Feb 13, 2026", time: "8:00 PM EST", participants: 95, price: 94.99, category: "Music", image: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=800" },
  { id: 135, title: "Jazz Improvisation", instructor: "Marcus Jazz", location: "Online, Live", date: "Feb 14, 2026", time: "7:00 PM EST", participants: 63, price: 79.99, category: "Music", image: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800" },
  { id: 136, title: "Ukulele for Beginners", instructor: "Isabella Uke", location: "Online, Live", date: "Feb 15, 2026", time: "5:00 PM EST", participants: 89, price: 54.99, category: "Music", image: "https://images.unsplash.com/photo-1590736969955-71cc94901144?w=800" },
  { id: 137, title: "Music Business & Copyright", instructor: "Oscar Business", location: "Online, Live", date: "Feb 16, 2026", time: "6:00 PM EST", participants: 71, price: 84.99, category: "Music", image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800" },
  { id: 138, title: "Logic Pro X Mastery", instructor: "Laura Logic", location: "Online, Live", date: "Feb 17, 2026", time: "5:00 PM EST", participants: 97, price: 99.99, category: "Music", image: "https://images.unsplash.com/photo-1598653222000-6b7b7a552625?w=800" },
  { id: 139, title: "Ableton Live Production", instructor: "Steven Ableton", location: "Online, Live", date: "Feb 18, 2026", time: "7:00 PM EST", participants: 104, price: 109.99, category: "Music", image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800" },
  { id: 140, title: "Classical Guitar Techniques", instructor: "George Classical", location: "Online, Live", date: "Feb 19, 2026", time: "6:00 PM EST", participants: 58, price: 69.99, category: "Music", image: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800" },

  // Health & Fitness (20 courses)
  { id: 141, title: "Yoga & Mindfulness for Wellness", instructor: "Sophia Lee", location: "Online, Live", date: "Jan 25, 2026", time: "9:00 AM EST", participants: 145, price: 49.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800" },
  { id: 142, title: "Nutrition & Meal Planning", instructor: "Dr. Nicole Harris", location: "Online, Live", date: "Jan 29, 2026", time: "11:00 AM EST", participants: 127, price: 54.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800" },
  { id: 143, title: "Meditation & Stress Management", instructor: "Dr. Sarah Chen", location: "Online, Live", date: "Feb 3, 2026", time: "6:30 AM EST", participants: 156, price: 44.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800" },
  { id: 144, title: "HIIT Workout Program", instructor: "Michael Fitness", location: "Online, Live", date: "Feb 4, 2026", time: "8:00 AM EST", participants: 132, price: 59.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800" },
  { id: 145, title: "Pilates Fundamentals", instructor: "Jennifer Core", location: "Online, Live", date: "Feb 5, 2026", time: "7:00 AM EST", participants: 118, price: 49.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800" },
  { id: 146, title: "Weight Training Basics", instructor: "Anthony Strength", location: "Online, Live", date: "Feb 6, 2026", time: "6:00 PM EST", participants: 103, price: 64.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800" },
  { id: 147, title: "Vegan Nutrition Guide", instructor: "Christina Plant", location: "Online, Live", date: "Feb 7, 2026", time: "10:00 AM EST", participants: 94, price: 54.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800" },
  { id: 148, title: "Running & Marathon Training", instructor: "Ryan Runner", location: "Online, Live", date: "Feb 8, 2026", time: "7:00 AM EST", participants: 87, price: 59.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=800" },
  { id: 149, title: "CrossFit Training", instructor: "Derek Cross", location: "Online, Live", date: "Feb 9, 2026", time: "6:00 AM EST", participants: 76, price: 69.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800" },
  { id: 150, title: "Flexibility & Stretching", instructor: "Isabella Stretch", location: "Online, Live", date: "Feb 10, 2026", time: "8:00 AM EST", participants: 108, price: 44.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800" },
  { id: 151, title: "Mental Health & Wellness", instructor: "Dr. Monica Mind", location: "Online, Live", date: "Feb 11, 2026", time: "5:00 PM EST", participants: 142, price: 54.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800" },
  { id: 152, title: "Bodybuilding Nutrition", instructor: "Peter Muscle", location: "Online, Live", date: "Feb 12, 2026", time: "7:00 AM EST", participants: 89, price: 64.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800" },
  { id: 153, title: "Zumba Dance Fitness", instructor: "Maria Dance", location: "Online, Live", date: "Feb 13, 2026", time: "6:00 PM EST", participants: 124, price: 49.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800" },
  { id: 154, title: "Sleep Optimization", instructor: "Jonathan Sleep", location: "Online, Live", date: "Feb 14, 2026", time: "9:00 PM EST", participants: 113, price: 44.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=800" },
  { id: 155, title: "Tai Chi for Beginners", instructor: "Marcus Chi", location: "Online, Live", date: "Feb 15, 2026", time: "8:00 AM EST", participants: 71, price: 49.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800" },
  { id: 156, title: "Sports Nutrition", instructor: "Vanessa Sports", location: "Online, Live", date: "Feb 16, 2026", time: "11:00 AM EST", participants: 96, price: 59.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800" },
  { id: 157, title: "Kickboxing Cardio", instructor: "Oscar Kick", location: "Online, Live", date: "Feb 17, 2026", time: "6:00 PM EST", participants: 81, price: 54.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800" },
  { id: 158, title: "Mindful Eating Practices", instructor: "Laura Mindful", location: "Online, Live", date: "Feb 18, 2026", time: "12:00 PM EST", participants: 104, price: 49.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800" },
  { id: 159, title: "Barre Fitness", instructor: "Catherine Barre", location: "Online, Live", date: "Feb 19, 2026", time: "7:00 AM EST", participants: 93, price: 54.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800" },
  { id: 160, title: "Home Workout Programs", instructor: "Brandon Home", location: "Online, Live", date: "Feb 20, 2026", time: "6:00 PM EST", participants: 137, price: 44.99, category: "Health & Fitness", image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800" },

  // Personal Development (20 courses)
  { id: 161, title: "Public Speaking Confidence", instructor: "Victoria Adams", location: "Online, Live", date: "Feb 3, 2026", time: "4:00 PM EST", participants: 122, price: 79.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800" },
  { id: 162, title: "Time Management Mastery", instructor: "Daniel Time", location: "Online, Live", date: "Feb 4, 2026", time: "11:00 AM EST", participants: 135, price: 64.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1501139083538-0139583c060f?w=800" },
  { id: 163, title: "Emotional Intelligence", instructor: "Jessica EQ", location: "Online, Live", date: "Feb 5, 2026", time: "2:00 PM EST", participants: 118, price: 74.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1515191107209-c28698631303?w=800" },
  { id: 164, title: "Goal Setting & Achievement", instructor: "Ryan Goals", location: "Online, Live", date: "Feb 6, 2026", time: "10:00 AM EST", participants: 142, price: 69.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800" },
  { id: 165, title: "Confidence Building", instructor: "Sophia Confidence", location: "Online, Live", date: "Feb 7, 2026", time: "3:00 PM EST", participants: 127, price: 74.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800" },
  { id: 166, title: "Productivity Hacks", instructor: "Tyler Productive", location: "Online, Live", date: "Feb 8, 2026", time: "9:00 AM EST", participants: 154, price: 59.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800" },
  { id: 167, title: "Creative Thinking Workshop", instructor: "Megan Creative", location: "Online, Live", date: "Feb 9, 2026", time: "1:00 PM EST", participants: 103, price: 69.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=800" },
  { id: 168, title: "Critical Thinking Skills", instructor: "Dr. Brandon Logic", location: "Online, Live", date: "Feb 10, 2026", time: "11:00 AM EST", participants: 94, price: 74.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800" },
  { id: 169, title: "Memory Improvement Techniques", instructor: "Catherine Memory", location: "Online, Live", date: "Feb 11, 2026", time: "2:00 PM EST", participants: 86, price: 64.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1515191107209-c28698631303?w=800" },
  { id: 170, title: "Speed Reading Mastery", instructor: "Peter Read", location: "Online, Live", date: "Feb 12, 2026", time: "10:00 AM EST", participants: 97, price: 59.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800" },
  { id: 171, title: "Personal Branding", instructor: "Monica Brand", location: "Online, Live", date: "Feb 13, 2026", time: "3:00 PM EST", participants: 114, price: 79.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800" },
  { id: 172, title: "Networking Skills", instructor: "Jonathan Network", location: "Online, Live", date: "Feb 14, 2026", time: "4:00 PM EST", participants: 108, price: 69.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1515169067868-5387ec356754?w=800" },
  { id: 173, title: "Career Transition Guide", instructor: "Marcus Career", location: "Online, Live", date: "Feb 15, 2026", time: "1:00 PM EST", participants: 121, price: 84.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800" },
  { id: 174, title: "Habit Formation", instructor: "Vanessa Habits", location: "Online, Live", date: "Feb 16, 2026", time: "10:00 AM EST", participants: 146, price: 64.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800" },
  { id: 175, title: "Interview Skills Mastery", instructor: "Oscar Interview", location: "Online, Live", date: "Feb 17, 2026", time: "2:00 PM EST", participants: 132, price: 69.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800" },
  { id: 176, title: "Work-Life Balance", instructor: "Laura Balance", location: "Online, Live", date: "Feb 18, 2026", time: "5:00 PM EST", participants: 118, price: 64.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800" },
  { id: 177, title: "Assertiveness Training", instructor: "Brandon Assert", location: "Online, Live", date: "Feb 19, 2026", time: "11:00 AM EST", participants: 95, price: 69.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1515169067868-5387ec356754?w=800" },
  { id: 178, title: "Decision Making Skills", instructor: "Steven Decide", location: "Online, Live", date: "Feb 20, 2026", time: "3:00 PM EST", participants: 103, price: 74.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800" },
  { id: 179, title: "Resilience & Mental Toughness", instructor: "George Strong", location: "Online, Live", date: "Feb 21, 2026", time: "9:00 AM EST", participants: 127, price: 79.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1515191107209-c28698631303?w=800" },
  { id: 180, title: "Communication Excellence", instructor: "Sofia Speak", location: "Online, Live", date: "Feb 22, 2026", time: "1:00 PM EST", participants: 139, price: 69.99, category: "Personal Development", image: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800" },

  // Teaching (20 courses)
  { id: 181, title: "Spanish Conversation Practice", instructor: "Carlos Rodriguez", location: "Online, Live", date: "Jan 25, 2026", time: "6:00 PM EST", participants: 76, price: 59.99, category: "Teaching", image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800" },
  { id: 182, title: "French Language Basics", instructor: "Marie Dubois", location: "Online, Live", date: "Feb 5, 2026", time: "6:00 PM EST", participants: 89, price: 59.99, category: "Teaching", image: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800" },
  { id: 183, title: "English as a Second Language", instructor: "Emma Teacher", location: "Online, Live", date: "Feb 6, 2026", time: "4:00 PM EST", participants: 124, price: 54.99, category: "Teaching", image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800" },
  { id: 184, title: "German for Beginners", instructor: "Hans Schmidt", location: "Online, Live", date: "Feb 7, 2026", time: "5:00 PM EST", participants: 68, price: 59.99, category: "Teaching", image: "https://images.unsplash.com/photo-1528716321680-815a8cdb8cbe?w=800" },
  { id: 185, title: "Mandarin Chinese Basics", instructor: "Li Wei", location: "Online, Live", date: "Feb 8, 2026", time: "7:00 PM EST", participants: 103, price: 64.99, category: "Teaching", image: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=800" },
  { id: 186, title: "Japanese Language & Culture", instructor: "Yuki Tanaka", location: "Online, Live", date: "Feb 9, 2026", time: "6:00 PM EST", participants: 94, price: 64.99, category: "Teaching", image: "https://images.unsplash.com/photo-1528164344705-47542687000d?w=800" },
  { id: 187, title: "Italian Conversation", instructor: "Marco Rossi", location: "Online, Live", date: "Feb 10, 2026", time: "5:00 PM EST", participants: 71, price: 59.99, category: "Teaching", image: "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=800" },
  { id: 188, title: "Portuguese for Travel", instructor: "Ana Silva", location: "Online, Live", date: "Feb 11, 2026", time: "7:00 PM EST", participants: 58, price: 54.99, category: "Teaching", image: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=800" },
  { id: 189, title: "Arabic Language Basics", instructor: "Ahmed Hassan", location: "Online, Live", date: "Feb 12, 2026", time: "6:00 PM EST", participants: 52, price: 64.99, category: "Teaching", image: "https://images.unsplash.com/photo-1578926078-609f4c45923c?w=800" },
  { id: 190, title: "Korean Language Fun", instructor: "Ji-hoon Kim", location: "Online, Live", date: "Feb 13, 2026", time: "7:00 PM EST", participants: 87, price: 59.99, category: "Teaching", image: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800" },
  { id: 191, title: "Russian for Beginners", instructor: "Olga Ivanova", location: "Online, Live", date: "Feb 14, 2026", time: "6:00 PM EST", participants: 46, price: 59.99, category: "Teaching", image: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=800" },
  { id: 192, title: "Sign Language Basics", instructor: "Sarah Hands", location: "Online, Live", date: "Feb 15, 2026", time: "4:00 PM EST", participants: 93, price: 54.99, category: "Teaching", image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800" },
  { id: 193, title: "Hindi Language Course", instructor: "Raj Patel", location: "Online, Live", date: "Feb 16, 2026", time: "7:00 PM EST", participants: 79, price: 59.99, category: "Teaching", image: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800" },
  { id: 194, title: "Turkish Language Intro", instructor: "Ayse Yilmaz", location: "Online, Live", date: "Feb 17, 2026", time: "6:00 PM EST", participants: 43, price: 54.99, category: "Teaching", image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800" },
  { id: 195, title: "Greek for Travel", instructor: "Dimitri Papadopoulos", location: "Online, Live", date: "Feb 18, 2026", time: "5:00 PM EST", participants: 38, price: 54.99, category: "Teaching", image: "https://images.unsplash.com/photo-1529077071945-d862c4e5bf5d?w=800" },
  { id: 196, title: "Swedish Language Basics", instructor: "Erik Andersson", location: "Online, Live", date: "Feb 19, 2026", time: "6:00 PM EST", participants: 51, price: 59.99, category: "Teaching", image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800" },
  { id: 197, title: "Dutch Language Course", instructor: "Anna van der Berg", location: "Online, Live", date: "Feb 20, 2026", time: "7:00 PM EST", participants: 42, price: 54.99, category: "Teaching", image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800" },
  { id: 198, title: "Polish for Beginners", instructor: "Katarzyna Nowak", location: "Online, Live", date: "Feb 21, 2026", time: "6:00 PM EST", participants: 36, price: 54.99, category: "Teaching", image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800" },
  { id: 199, title: "Indonesian Language", instructor: "Budi Santoso", location: "Online, Live", date: "Feb 22, 2026", time: "7:00 PM EST", participants: 47, price: 54.99, category: "Teaching", image: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800" },
  { id: 200, title: "Thai Language Basics", instructor: "Somchai Wong", location: "Online, Live", date: "Feb 23, 2026", time: "6:00 PM EST", participants: 53, price: 54.99, category: "Teaching", image: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800" },

  // Data Science (20 courses)
  { id: 201, title: "Python for Data Science", instructor: "Dr. Amanda Foster", location: "Online, Live", date: "Jan 26, 2026", time: "10:00 AM EST", participants: 132, price: 119.99, category: "Data Science", image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800" },
  { id: 202, title: "Machine Learning Fundamentals", instructor: "Dr. Eric Wang", location: "Online, Live", date: "Feb 4, 2026", time: "11:00 AM EST", participants: 148, price: 134.99, category: "Data Science", image: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800" },
  { id: 203, title: "Data Visualization with Tableau", instructor: "Jessica Visual", location: "Online, Live", date: "Feb 5, 2026", time: "2:00 PM EST", participants: 97, price: 89.99, category: "Data Science", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800" },
  { id: 204, title: "R Programming for Analytics", instructor: "Ryan Stats", location: "Online, Live", date: "Feb 6, 2026", time: "1:00 PM EST", participants: 82, price: 109.99, category: "Data Science", image: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800" },
  { id: 205, title: "Deep Learning with TensorFlow", instructor: "Dr. Sophia Neural", location: "Online, Live", date: "Feb 7, 2026", time: "10:00 AM EST", participants: 124, price: 144.99, category: "Data Science", image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800" },
  { id: 206, title: "SQL for Data Analysis", instructor: "Tyler Database", location: "Online, Live", date: "Feb 8, 2026", time: "3:00 PM EST", participants: 143, price: 79.99, category: "Data Science", image: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800" },
  { id: 207, title: "Natural Language Processing", instructor: "Dr. Megan NLP", location: "Online, Live", date: "Feb 9, 2026", time: "11:00 AM EST", participants: 103, price: 129.99, category: "Data Science", image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800" },
  { id: 208, title: "Statistical Analysis with Python", instructor: "Brandon Stats", location: "Online, Live", date: "Feb 10, 2026", time: "2:00 PM EST", participants: 91, price: 99.99, category: "Data Science", image: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800" },
  { id: 209, title: "Data Mining Techniques", instructor: "Catherine Mine", location: "Online, Live", date: "Feb 11, 2026", time: "10:00 AM EST", participants: 76, price: 109.99, category: "Data Science", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800" },
  { id: 210, title: "Business Intelligence with Power BI", instructor: "Peter BI", location: "Online, Live", date: "Feb 12, 2026", time: "1:00 PM EST", participants: 108, price: 94.99, category: "Data Science", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800" },
  { id: 211, title: "Predictive Analytics", instructor: "Monica Predict", location: "Online, Live", date: "Feb 13, 2026", time: "11:00 AM EST", participants: 89, price: 119.99, category: "Data Science", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800" },
  { id: 212, title: "Time Series Analysis", instructor: "Jonathan Time", location: "Online, Live", date: "Feb 14, 2026", time: "2:00 PM EST", participants: 71, price: 114.99, category: "Data Science", image: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800" },
  { id: 213, title: "Data Science with Excel", instructor: "Marcus Excel", location: "Online, Live", date: "Feb 15, 2026", time: "10:00 AM EST", participants: 127, price: 74.99, category: "Data Science", image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800" },
  { id: 214, title: "Spark for Big Data", instructor: "Vanessa Big", location: "Online, Live", date: "Feb 16, 2026", time: "1:00 PM EST", participants: 68, price: 124.99, category: "Data Science", image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800" },
  { id: 215, title: "Data Ethics & Privacy", instructor: "Dr. Oscar Ethics", location: "Online, Live", date: "Feb 17, 2026", time: "3:00 PM EST", participants: 94, price: 89.99, category: "Data Science", image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800" },
  { id: 216, title: "Computer Vision Applications", instructor: "Dr. Laura Vision", location: "Online, Live", date: "Feb 18, 2026", time: "11:00 AM EST", participants: 86, price: 134.99, category: "Data Science", image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800" },
  { id: 217, title: "Reinforcement Learning", instructor: "Brandon RL", location: "Online, Live", date: "Feb 19, 2026", time: "10:00 AM EST", participants: 62, price: 139.99, category: "Data Science", image: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800" },
  { id: 218, title: "Data Engineering Fundamentals", instructor: "Steven Engineer", location: "Online, Live", date: "Feb 20, 2026", time: "2:00 PM EST", participants: 97, price: 119.99, category: "Data Science", image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800" },
  { id: 219, title: "Feature Engineering", instructor: "George Features", location: "Online, Live", date: "Feb 21, 2026", time: "11:00 AM EST", participants: 73, price: 109.99, category: "Data Science", image: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800" },
  { id: 220, title: "A/B Testing & Experimentation", instructor: "Sofia Test", location: "Online, Live", date: "Feb 22, 2026", time: "1:00 PM EST", participants: 104, price: 99.99, category: "Data Science", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800" },

  // Finance (20 courses)
  { id: 221, title: "Personal Finance Management", instructor: "Jennifer Money", location: "Online, Live", date: "Feb 3, 2026", time: "6:00 PM EST", participants: 142, price: 64.99, category: "Finance", image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800" },
  { id: 222, title: "Stock Market Investing", instructor: "Michael Stocks", location: "Online, Live", date: "Feb 4, 2026", time: "5:00 PM EST", participants: 156, price: 89.99, category: "Finance", image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800" },
  { id: 223, title: "Cryptocurrency Trading", instructor: "Anthony Crypto", location: "Online, Live", date: "Feb 5, 2026", time: "7:00 PM EST", participants: 187, price: 99.99, category: "Finance", image: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800" },
  { id: 224, title: "Real Estate Investing", instructor: "Christina Property", location: "Online, Live", date: "Feb 6, 2026", time: "6:00 PM EST", participants: 134, price: 94.99, category: "Finance", image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800" },
  { id: 225, title: "Forex Trading Basics", instructor: "Ryan Forex", location: "Online, Live", date: "Feb 7, 2026", time: "8:00 PM EST", participants: 119, price: 109.99, category: "Finance", image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800" },
  { id: 226, title: "Financial Planning & Retirement", instructor: "Dr. Derek Plan", location: "Online, Live", date: "Feb 8, 2026", time: "5:00 PM EST", participants: 97, price: 79.99, category: "Finance", image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800" },
  { id: 227, title: "Tax Planning Strategies", instructor: "Isabella Tax", location: "Online, Live", date: "Feb 9, 2026", time: "6:00 PM EST", participants: 103, price: 74.99, category: "Finance", image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800" },
  { id: 228, title: "Options Trading Mastery", instructor: "Peter Options", location: "Online, Live", date: "Feb 10, 2026", time: "7:00 PM EST", participants: 124, price: 119.99, category: "Finance", image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800" },
  { id: 229, title: "Credit Score Improvement", instructor: "Monica Credit", location: "Online, Live", date: "Feb 11, 2026", time: "5:00 PM EST", participants: 147, price: 54.99, category: "Finance", image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800" },
  { id: 230, title: "Passive Income Strategies", instructor: "Jonathan Passive", location: "Online, Live", date: "Feb 12, 2026", time: "6:00 PM EST", participants: 168, price: 84.99, category: "Finance", image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800" },
  { id: 231, title: "Wealth Building Blueprint", instructor: "Marcus Wealth", location: "Online, Live", date: "Feb 13, 2026", time: "7:00 PM EST", participants: 135, price: 99.99, category: "Finance", image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800" },
  { id: 232, title: "Budgeting & Saving Hacks", instructor: "Vanessa Save", location: "Online, Live", date: "Feb 14, 2026", time: "5:00 PM EST", participants: 152, price: 49.99, category: "Finance", image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800" },
  { id: 233, title: "Investment Portfolio Management", instructor: "Oscar Portfolio", location: "Online, Live", date: "Feb 15, 2026", time: "6:00 PM EST", participants: 112, price: 94.99, category: "Finance", image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800" },
  { id: 234, title: "Accounting for Non-Accountants", instructor: "Laura Numbers", location: "Online, Live", date: "Feb 16, 2026", time: "5:00 PM EST", participants: 89, price: 74.99, category: "Finance", image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800" },
  { id: 235, title: "Insurance Planning", instructor: "Brandon Insure", location: "Online, Live", date: "Feb 17, 2026", time: "6:00 PM EST", participants: 76, price: 64.99, category: "Finance", image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800" },
  { id: 236, title: "Estate Planning Basics", instructor: "Catherine Estate", location: "Online, Live", date: "Feb 18, 2026", time: "5:00 PM EST", participants: 68, price: 79.99, category: "Finance", image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800" },
  { id: 237, title: "Financial Literacy for Beginners", instructor: "Steven Basics", location: "Online, Live", date: "Feb 19, 2026", time: "6:00 PM EST", participants: 163, price: 44.99, category: "Finance", image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800" },
  { id: 238, title: "Day Trading Strategies", instructor: "George Trade", location: "Online, Live", date: "Feb 20, 2026", time: "8:00 PM EST", participants: 141, price: 129.99, category: "Finance", image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800" },
  { id: 239, title: "Debt Management & Freedom", instructor: "Sofia Debt", location: "Online, Live", date: "Feb 21, 2026", time: "5:00 PM EST", participants: 128, price: 59.99, category: "Finance", image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800" },
  { id: 240, title: "Financial Independence & FIRE", instructor: "Jason FIRE", location: "Online, Live", date: "Feb 22, 2026", time: "6:00 PM EST", participants: 146, price: 89.99, category: "Finance", image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800" },

  // Language (20 courses)
  { id: 241, title: "English Grammar Mastery", instructor: "Christine Grammar", location: "Online, Live", date: "Feb 3, 2026", time: "10:00 AM EST", participants: 132, price: 54.99, category: "Language", image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800" },
  { id: 242, title: "Creative Writing Workshop", instructor: "Leonard Writer", location: "Online, Live", date: "Feb 4, 2026", time: "2:00 PM EST", participants: 98, price: 74.99, category: "Language", image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800" },
  { id: 243, title: "Business Writing Skills", instructor: "Dr. Alice Write", location: "Online, Live", date: "Feb 5, 2026", time: "11:00 AM EST", participants: 116, price: 69.99, category: "Language", image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800" },
  { id: 244, title: "Technical Writing Essentials", instructor: "Timothy Tech", location: "Online, Live", date: "Feb 6, 2026", time: "3:00 PM EST", participants: 84, price: 64.99, category: "Language", image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800" },
  { id: 245, title: "Poetry Writing & Analysis", instructor: "Melissa Poet", location: "Online, Live", date: "Feb 7, 2026", time: "4:00 PM EST", participants: 67, price: 59.99, category: "Language", image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800" },
  { id: 246, title: "Screenwriting Fundamentals", instructor: "George Screen", location: "Online, Live", date: "Feb 8, 2026", time: "6:00 PM EST", participants: 92, price: 84.99, category: "Language", image: "https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?w=800" },
  { id: 247, title: "IELTS Preparation Course", instructor: "Sofia IELTS", location: "Online, Live", date: "Feb 9, 2026", time: "10:00 AM EST", participants: 147, price: 89.99, category: "Language", image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800" },
  { id: 248, title: "TOEFL Test Prep", instructor: "Jason TOEFL", location: "Online, Live", date: "Feb 10, 2026", time: "2:00 PM EST", participants: 128, price: 89.99, category: "Language", image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800" },
  { id: 249, title: "Content Writing for Blogs", instructor: "Natalie Blog", location: "Online, Live", date: "Feb 11, 2026", time: "11:00 AM EST", participants: 103, price: 69.99, category: "Language", image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800" },
  { id: 250, title: "Academic Writing Excellence", instructor: "Dr. Marcus Academic", location: "Online, Live", date: "Feb 12, 2026", time: "1:00 PM EST", participants: 86, price: 79.99, category: "Language", image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800" },
  { id: 251, title: "English Pronunciation Practice", instructor: "Victoria Speak", location: "Online, Live", date: "Feb 13, 2026", time: "3:00 PM EST", participants: 119, price: 54.99, category: "Language", image: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800" },
  { id: 252, title: "Storytelling & Narrative", instructor: "Henry Story", location: "Online, Live", date: "Feb 14, 2026", time: "4:00 PM EST", participants: 94, price: 74.99, category: "Language", image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800" },
  { id: 253, title: "Copyediting & Proofreading", instructor: "Angela Edit", location: "Online, Live", date: "Feb 15, 2026", time: "2:00 PM EST", participants: 71, price: 64.99, category: "Language", image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800" },
  { id: 254, title: "Vocabulary Building", instructor: "Patricia Words", location: "Online, Live", date: "Feb 16, 2026", time: "10:00 AM EST", participants: 108, price: 49.99, category: "Language", image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800" },
  { id: 255, title: "Public Speaking & Presentation", instructor: "Thomas Speak", location: "Online, Live", date: "Feb 17, 2026", time: "3:00 PM EST", participants: 126, price: 79.99, category: "Language", image: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800" },
  { id: 256, title: "Debate & Argumentation", instructor: "Nancy Debate", location: "Online, Live", date: "Feb 18, 2026", time: "4:00 PM EST", participants: 73, price: 69.99, category: "Language", image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800" },
  { id: 257, title: "Fiction Writing Masterclass", instructor: "Kevin Fiction", location: "Online, Live", date: "Feb 19, 2026", time: "5:00 PM EST", participants: 87, price: 84.99, category: "Language", image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800" },
  { id: 258, title: "Non-Fiction Writing", instructor: "Rachel Nonfiction", location: "Online, Live", date: "Feb 20, 2026", time: "2:00 PM EST", participants: 64, price: 74.99, category: "Language", image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800" },
  { id: 259, title: "Email Writing Essentials", instructor: "Gregory Email", location: "Online, Live", date: "Feb 21, 2026", time: "11:00 AM EST", participants: 142, price: 49.99, category: "Language", image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800" },
  { id: 260, title: "Latin Language Basics", instructor: "Dr. Claudia Latin", location: "Online, Live", date: "Feb 22, 2026", time: "3:00 PM EST", participants: 41, price: 64.99, category: "Language", image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800" },

  // Lifestyle (20 courses)
  { id: 261, title: "Interior Design Basics", instructor: "Samantha Home", location: "Online, Live", date: "Feb 3, 2026", time: "2:00 PM EST", participants: 124, price: 79.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800" },
  { id: 262, title: "Gardening for Beginners", instructor: "Gregory Green", location: "Online, Live", date: "Feb 4, 2026", time: "10:00 AM EST", participants: 103, price: 54.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800" },
  { id: 263, title: "Minimalist Living", instructor: "Michelle Less", location: "Online, Live", date: "Feb 5, 2026", time: "3:00 PM EST", participants: 147, price: 59.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1519643381401-22c77e60520e?w=800" },
  { id: 264, title: "Sustainable Living Practices", instructor: "Daniel Earth", location: "Online, Live", date: "Feb 6, 2026", time: "11:00 AM EST", participants: 132, price: 64.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800" },
  { id: 265, title: "Home Organization Mastery", instructor: "Amanda Tidy", location: "Online, Live", date: "Feb 7, 2026", time: "1:00 PM EST", participants: 168, price: 49.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1631048500524-34453408951e?w=800" },
  { id: 266, title: "Cooking Basics for Beginners", instructor: "Craig Chef", location: "Online, Live", date: "Feb 8, 2026", time: "6:00 PM EST", participants: 187, price: 69.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800" },
  { id: 267, title: "Baking & Pastry", instructor: "Samantha Baker", location: "Online, Live", date: "Feb 9, 2026", time: "5:00 PM EST", participants: 156, price: 74.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800" },
  { id: 268, title: "Wine Tasting & Appreciation", instructor: "Eric Sommelier", location: "Online, Live", date: "Feb 10, 2026", time: "7:00 PM EST", participants: 94, price: 84.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800" },
  { id: 269, title: "Pet Training & Care", instructor: "Victoria Pets", location: "Online, Live", date: "Feb 11, 2026", time: "4:00 PM EST", participants: 119, price: 59.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800" },
  { id: 270, title: "Parenting Skills Workshop", instructor: "Henry Parent", location: "Online, Live", date: "Feb 12, 2026", time: "6:00 PM EST", participants: 142, price: 69.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=800" },
  { id: 271, title: "Fashion Styling Basics", instructor: "Melissa Style", location: "Online, Live", date: "Feb 13, 2026", time: "5:00 PM EST", participants: 135, price: 74.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800" },
  { id: 272, title: "DIY Home Improvement", instructor: "George DIY", location: "Online, Live", date: "Feb 14, 2026", time: "2:00 PM EST", participants: 97, price: 64.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1585129777188-94600bc7b4cb?w=800" },
  { id: 273, title: "Travel Planning & Hacks", instructor: "Sofia Travel", location: "Online, Live", date: "Feb 15, 2026", time: "4:00 PM EST", participants: 154, price: 54.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800" },
  { id: 274, title: "Makeup & Beauty Essentials", instructor: "Jason Beauty", location: "Online, Live", date: "Feb 16, 2026", time: "3:00 PM EST", participants: 173, price: 59.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800" },
  { id: 275, title: "Coffee Brewing Mastery", instructor: "Christine Coffee", location: "Online, Live", date: "Feb 17, 2026", time: "9:00 AM EST", participants: 112, price: 49.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800" },
  { id: 276, title: "Cocktail Making & Mixology", instructor: "Leonard Mix", location: "Online, Live", date: "Feb 18, 2026", time: "7:00 PM EST", participants: 108, price: 69.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800" },
  { id: 277, title: "Relationship Building", instructor: "Dr. Alice Connect", location: "Online, Live", date: "Feb 19, 2026", time: "6:00 PM EST", participants: 127, price: 74.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800" },
  { id: 278, title: "Wardrobe Capsule Creation", instructor: "Timothy Fashion", location: "Online, Live", date: "Feb 20, 2026", time: "3:00 PM EST", participants: 89, price: 64.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800" },
  { id: 279, title: "Woodworking for Beginners", instructor: "Brandon Wood", location: "Online, Live", date: "Feb 21, 2026", time: "2:00 PM EST", participants: 73, price: 79.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1607400201889-565b1ee75f8e?w=800" },
  { id: 280, title: "Mindful Morning Routines", instructor: "Catherine Morning", location: "Online, Live", date: "Feb 22, 2026", time: "7:00 AM EST", participants: 164, price: 44.99, category: "Lifestyle", image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800" },
];

// Helper function to get courses by category
export function getCoursesByCategory(category: string): Course[] {
  if (category === "All") {
    return allCourses;
  }
  return allCourses.filter(course => course.category === category);
}

export const CATEGORY_SLUG_MAP: Record<string, string> = {
  development: "Development",
  design: "Design",
  marketing: "Marketing",
  business: "Business",
  photography: "Photography",
  music: "Music",
  "health-wellness": "Health & Fitness",
  languages: "Teaching",
  technology: "Technology",
  "data-science": "Data Science",
  finance: "Finance",
  lifestyle: "Lifestyle",
  "personal-development": "Personal Development",
};

export function getCoursesByCategorySlug(slug: string): Course[] {
  const categoryName = CATEGORY_SLUG_MAP[slug];
  if (!categoryName) return [];
  return allCourses.filter((course) => course.category === categoryName);
}

export function getCourseById(id: number | string): Course | undefined {
  const numId = typeof id === "string" ? parseInt(id, 10) : id;
  if (Number.isNaN(numId)) return undefined;
  return allCourses.find((course) => course.id === numId);
}

export function searchCourses(query: string): Course[] {
  const q = query.trim().toLowerCase();
  if (!q) return allCourses;
  return allCourses.filter(
    (course) =>
      course.title.toLowerCase().includes(q) ||
      course.instructor.toLowerCase().includes(q) ||
      course.category.toLowerCase().includes(q)
  );
}

export type ClassDetailData = {
  id: number;
  slug: string;
  title: string;
  description: string;
  instructor: { name: string; title: string; bio: string; image: string };
  duration: string;
  durationBase: string;
  format: string;
  attendance: string;
  price: number;
  startDate: string;
  students: number;
  rating: number;
  video: string;
  category?: string;
};

const DEFAULT_INSTRUCTOR_BIO =
  "Nexnoon experts are experienced professionals hand-picked for their industry knowledge and teaching excellence. They bring real-world insights from leading companies to deliver practical, interactive learning experiences that accelerate your growth.";

function parseCourseDate(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return "2026-02-01";
  return parsed.toISOString().split("T")[0];
}

function slugifyTitle(title: string): string {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "class"
  );
}

export function courseToClassDetail(course: Course): ClassDetailData {
  return {
    id: course.id,
    slug: slugifyTitle(course.title),
    title: course.title,
    description: `Master ${course.category.toLowerCase()} skills in this live online class with ${course.instructor}. Interactive sessions, hands-on practice, and expert feedback — ${course.location}.`,
    instructor: {
      name: course.instructor,
      title: "Nexnoon Expert",
      bio: DEFAULT_INSTRUCTOR_BIO,
      image: "",
    },
    duration: "4",
    durationBase: "Weeks",
    format: "Live",
    attendance: "ONLINE",
    price: course.price,
    startDate: parseCourseDate(course.date),
    students: course.participants,
    rating: 4.8,
    video: "https://www.youtube.com/embed/Ke90Tje7VS0",
    category: course.category,
  };
}

export function courseToApiClass(course: Course) {
  return {
    id: String(course.id),
    title: course.title,
    description: courseToClassDetail(course).description,
    category: course.category,
    level: "Intermediate" as const,
    price: course.price,
    currency: "EUR",
    instructor: { id: String(course.id), name: course.instructor },
    thumbnail: course.image,
    duration: 240,
    totalSessions: 8,
    enrolledStudents: course.participants,
    rating: 4.8,
    reviewsCount: Math.floor(course.participants / 10),
    isLive: true,
    startDate: parseCourseDate(course.date),
    status: "published" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function courseToCategoryListItem(course: Course) {
  return {
    id: course.id,
    title: course.title,
    instructor: course.instructor,
    rating: 4.8,
    students: course.participants,
    price: course.price,
    duration: "4 weeks",
    level: "Intermediate" as const,
    thumbnail: course.image,
    nextSession: `${course.date} at ${course.time}`,
  };
}

export function courseToSearchResult(course: Course) {
  return {
    id: course.id,
    title: course.title,
    instructor: course.instructor,
    category: course.category,
    level: "All Levels" as const,
    rating: 4.8,
    students: course.participants,
    price: course.price,
    duration: "4 weeks",
    thumbnail: course.image,
  };
}
