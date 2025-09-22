import React from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface TributeModalProps {
	isOpen: boolean;
	onClose: () => void;
}

// A soft, warm tribute modal for Luky the fox
const TributeModal: React.FC<TributeModalProps> = ({ isOpen, onClose }) => {
	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					className="fixed inset-0 z-[70]"
					onClick={onClose}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2, ease: 'easeOut' }}
				>
					<div className="absolute inset-0 bg-gradient-to-br from-amber-900/25 via-stone-900/30 to-orange-900/25 backdrop-blur-sm" />
					<div className="relative w-full h-full flex items-center justify-center p-4">
						<motion.div
							className="relative w-full max-w-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-stone-800 dark:to-amber-950/30 rounded-3xl border border-amber-200/60 dark:border-amber-700/30 shadow-2xl overflow-hidden"
							onClick={(e) => e.stopPropagation()}
							role="dialog"
							aria-modal="true"
							aria-labelledby="luky-title"
							initial={{ opacity: 0, y: 12, scale: 0.98 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: 8, scale: 0.98 }}
							transition={{ duration: 0.25, ease: 'easeOut' }}
						>
					<button
						onClick={onClose}
						className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-600 text-white border border-amber-200/60 shadow-lg hover:shadow-xl"
						aria-label="Close tribute"
					>
						<X size={18} />
					</button>

					<div className="p-6 md:p-8">
						<div className="flex items-start gap-6">
							<div className="relative flex-shrink-0">
								<img
									src="/Lisak_Luky2.png"
									alt="Luky the fox"
									className="w-28 h-28 md:w-32 md:h-32 object-cover rounded-2xl border border-amber-200/60 dark:border-amber-700/40 shadow-md bg-white/60 dark:bg-stone-900/60"
								/>
								<div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-amber-100/90 dark:bg-amber-800/60 border border-amber-200/60 dark:border-amber-700/40 flex items-center justify-center shadow overflow-hidden">
									<img src="/luky_heart.png" alt="Heart for Luky" className="w-6 h-6 md:w-7 md:h-7 object-contain drop-shadow-sm" />
								</div>
							</div>

							<div className="flex-1">
								<h2 id="luky-title" className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-amber-800 to-orange-700 dark:from-amber-200 dark:to-orange-200 bg-clip-text text-transparent">
									For Luky, the Gentle Fox
								</h2>
								<p className="mt-2 text-amber-800/90 dark:text-amber-100/90 text-sm md:text-base">
									Luky lived a long, cozy life at the Pavlov rescue station, where he grew from a tiny, blind kit into a beloved friend to humans. He was rescued as a baby and, having known kindness from the start, chose to stay close to people forever.
								</p>
								<p className="mt-3 text-amber-800/90 dark:text-amber-100/90 text-sm md:text-base">
									Everyone who met him remembers his brave little heart. He never showed anger, even at the vet—only trust. He greeted visitors with sparkly eyes, loved a gentle scritch, and would offer a friendly paw for a little treat. He even had a foxy sense of humor, “borrowing” hats and small treasures from guests.
								</p>
								<p className="mt-3 text-amber-800/90 dark:text-amber-100/90 text-sm md:text-base">
									He adored people (especially children) and the sunshine, and had a soft spot for apple strudel. In his older years he moved slower, turned into a wise and cuddly grandpa, and the staff cared for him with tenderness and respect.
								</p>
								<p className="mt-3 text-amber-800/90 dark:text-amber-100/90 text-sm md:text-base">
									At fourteen and a half—a remarkable age for a fox—Luky crossed the quiet path beyond, loved and safe. Thank you for the joy, Luky. Your pawprints are warm in our hearts.
								</p>
								<div className="mt-4 text-xs md:text-sm text-amber-700/70 dark:text-amber-300/70">
									Inspired by reports from Stanice Pavlov and the memories of visitors who loved him.
								</div>
							</div>
						</div>
					</div>
						</motion.div>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
};

export default TributeModal;

