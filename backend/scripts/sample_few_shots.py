#!/usr/bin/env python3
"""
Script to sample dialogue examples from global_dataset.csv based on archetype weights
and save as JSON file for manual integration into character prompt files.

Usage:
    python scripts/sample_few_shots.py --character 艾莉丝 --samples 150
"""

import pandas as pd
import json
import random
import argparse
import importlib.util
import os
import sys
from pathlib import Path

def load_character_config(character_name):
    """Load archetype weights from character file"""
    try:
        # Get the script directory and navigate to prompts/characters
        script_dir = Path(__file__).parent
        char_file = script_dir.parent / "prompts" / "characters" / f"{character_name}.py"
        
        if not char_file.exists():
            raise FileNotFoundError(f"Character file not found: {char_file}")
        
        # Load the module
        spec = importlib.util.spec_from_file_location("char_module", char_file)
        char_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(char_module)
        
        # Get archetype weights
        if not hasattr(char_module, 'ARCHETYPE_WEIGHTS'):
            raise AttributeError(f"ARCHETYPE_WEIGHTS not found in {character_name}.py")
        
        return char_module.ARCHETYPE_WEIGHTS
    except Exception as e:
        print(f"Error loading character config: {e}")
        return None

def sample_by_archetype(df, archetype_weights, total_samples=150):
    """Sample dialogues based on archetype weights"""
    sampled_dialogues = []
    archetype_stats = {}
    
    print(f"Available archetypes in dataset: {df['archetype'].unique()}")
    print(f"Dataset size: {len(df)} total dialogues")
    
    for archetype, weight in archetype_weights.items():
        # Filter by archetype
        archetype_df = df[df['archetype'] == archetype]
        
        # Calculate samples for this archetype
        num_samples = int(total_samples * weight)
        archetype_stats[archetype] = {
            'weight': weight,
            'requested_samples': num_samples,
            'available_samples': len(archetype_df),
            'actual_samples': 0
        }
        
        print(f"\nArchetype: {archetype}")
        print(f"  Weight: {weight} ({weight*100:.1f}%)")
        print(f"  Requested samples: {num_samples}")
        print(f"  Available samples: {len(archetype_df)}")
        
        if len(archetype_df) >= num_samples:
            # Sample the requested number
            samples = archetype_df.sample(n=num_samples, random_state=42)
            archetype_stats[archetype]['actual_samples'] = num_samples
            print(f"  ✓ Sampled: {num_samples}")
        else:
            # Take all available samples
            samples = archetype_df
            archetype_stats[archetype]['actual_samples'] = len(archetype_df)
            print(f"  ⚠ Warning: Only {len(archetype_df)} available, took all")
        
        # Add to results
        for _, row in samples.iterrows():
            sampled_dialogues.append({
                "user": row['user'],
                "assistant": row['assistant'],
                "archetype": row['archetype']  # Include archetype for reference
            })
    
    # Print summary
    print(f"\n=== Sampling Summary ===")
    total_actual = sum(stats['actual_samples'] for stats in archetype_stats.values())
    print(f"Total sampled: {total_actual} / {total_samples} requested")
    
    for archetype, stats in archetype_stats.items():
        actual_weight = stats['actual_samples'] / total_actual if total_actual > 0 else 0
        print(f"{archetype}: {stats['actual_samples']} samples ({actual_weight:.1%})")
    
    return sampled_dialogues, archetype_stats

def main():
    parser = argparse.ArgumentParser(description='Sample few-shot dialogues based on archetype weights')
    parser.add_argument('--character', default='艾莉丝', help='Character name (default: 艾莉丝)')
    parser.add_argument('--input', default='../global_dataset.csv', help='Input CSV file (default: ../global_dataset.csv)')
    parser.add_argument('--samples', type=int, default=150, help='Total number of samples (default: 150)')
    parser.add_argument('--output-dir', default='prompts/characters', help='Output directory (default: prompts/characters)')
    
    args = parser.parse_args()
    
    # Resolve paths
    script_dir = Path(__file__).parent
    input_path = script_dir.parent / args.input if args.input.startswith('../') else Path(args.input)
    output_dir = script_dir.parent / args.output_dir
    
    print(f"=== Archetype-based Few-shot Sampling ===")
    print(f"Character: {args.character}")
    print(f"Input file: {input_path}")
    print(f"Target samples: {args.samples}")
    print(f"Output directory: {output_dir}")
    
    # Check if input file exists
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        return 1
    
    # Load CSV
    try:
        df = pd.read_csv(input_path)
        print(f"✓ Loaded {len(df)} dialogues from CSV")
    except Exception as e:
        print(f"Error loading CSV: {e}")
        return 1
    
    # Validate CSV structure
    required_columns = ['book_name', 'pair_id', 'user', 'assistant', 'archetype']
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        print(f"Error: Missing columns in CSV: {missing_columns}")
        return 1
    
    # Load character configuration
    archetype_weights = load_character_config(args.character)
    if archetype_weights is None:
        print(f"Error: Could not load archetype weights for character '{args.character}'")
        return 1
    
    print(f"✓ Loaded archetype weights: {archetype_weights}")
    
    # Sample dialogues
    sampled_dialogues, stats = sample_by_archetype(df, archetype_weights, args.samples)
    
    if not sampled_dialogues:
        print("Error: No dialogues were sampled")
        return 1
    
    # Prepare output
    output_data = {
        "character": args.character,
        "total_samples": len(sampled_dialogues),
        "archetype_weights": archetype_weights,
        "sampling_stats": stats,
        "dialogues": [
            {
                "user": dialogue["user"],
                "assistant": dialogue["assistant"]
            } for dialogue in sampled_dialogues
        ]
    }
    
    # Save to JSON file
    output_file = output_dir / f"sampled_few_shots_{args.character}.json"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        with open(output_file, "w", encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        print(f"✓ Saved to: {output_file}")
    except Exception as e:
        print(f"Error saving JSON file: {e}")
        return 1
    
    # Print next steps
    print(f"\n=== Next Steps ===")
    print(f"1. Review the generated file: {output_file}")
    print(f"2. Copy the 'dialogues' array content")
    print(f"3. Update FEW_SHOT_EXAMPLES in prompts/characters/{args.character}.py")
    print(f"4. Test the character responses")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())