import logging
import sys

def setup_logger():
    logger = logging.getLogger("TicketSystem")
    logger.setLevel(logging.INFO)
    
    # Check if handlers already exist to avoid duplicate logs in reload mode
    if not logger.handlers:
        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
        
        # Optional: Add a file handler if you want to save logs to a file
        # file_handler = logging.FileHandler("system.log")
        # file_handler.setFormatter(formatter)
        # logger.addHandler(file_handler)
        
    return logger

logger = setup_logger()