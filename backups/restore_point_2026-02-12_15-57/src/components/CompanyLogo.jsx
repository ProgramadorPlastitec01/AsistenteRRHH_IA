import { motion } from 'framer-motion';

const CompanyLogo = ({ className = "", size = 150 }) => {
    return (
        <motion.div
            className={`flex items-center justify-center ${className}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
        >
            <img
                src="/logo-plastitec.png"
                alt="Plastitec Logo"
                style={{ width: `${size}px`, height: 'auto' }}
                className="object-contain"
                onError={(e) => {
                    // Fallback to a styled placeholder if image is missing
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = '<span class="text-2xl font-black text-white px-4 border-l-4 border-primary-500">PLASTITEC</span>';
                }}
            />
        </motion.div>
    );
};

export default CompanyLogo;
