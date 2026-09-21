import { Facebook, Twitter, Instagram, Linkedin } from "lucide-react";
import { Link } from "react-router";

export default function Footer() {
  return (
    <footer className="site-footer bg-gray-900 text-gray-300 mx-0 mb-0">
      <div className="w-[90vw] mx-auto py-12">
        {/* Main Footer Content */}
        <div className="mb-8">
          {/* Brand Section */}
          <div className="max-w-md">
            <h3 className="text-2xl font-bold text-white mb-4">
              <span className="text-[#889dd1]">N</span>exnoon
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Live online classes with expert Nexnoon Experts. Learn, grow, and achieve your goals in real-time.
            </p>
            
            {/* Social Media */}
            <div className="flex space-x-4">
              <a href="#" className="hover:text-[#889dd1] transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="hover:text-[#889dd1] transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="hover:text-[#889dd1] transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="hover:text-[#889dd1] transition-colors">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-400">
            <p>&copy; 2026 Hillpad Nexnoon. All rights reserved.</p>
            <div className="flex gap-6 mt-2 sm:mt-0">
              <Link to="/contact" className="hover:text-[#889dd1] transition-colors">Support</Link>
              <Link to="/terms" className="hover:text-[#889dd1] transition-colors">Terms</Link>
              <Link to="/privacy" className="hover:text-[#889dd1] transition-colors">Privacy</Link>
              <Link to="/about" className="hover:text-[#889dd1] transition-colors">About</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
